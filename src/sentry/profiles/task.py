from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from time import sleep, time
from typing import Any, List, Mapping, MutableMapping, Optional, Tuple

import msgpack
import sentry_sdk
from django.conf import settings
from pytz import UTC
from symbolic import ProguardMapper  # type: ignore

from sentry import quotas
from sentry.constants import DataCategory
from sentry.lang.javascript.processing import _handles_frame as is_valid_javascript_frame
from sentry.lang.javascript.processing import generate_scraping_config
from sentry.lang.native.symbolicator import RetrySymbolication, Symbolicator, SymbolicatorTaskKind
from sentry.models import EventError, Organization, Project, ProjectDebugFile
from sentry.profiles.device import classify_device
from sentry.profiles.utils import get_from_profiling_service
from sentry.signals import first_profile_received
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics
from sentry.utils.outcomes import Outcome, track_outcome

Profile = MutableMapping[str, Any]
CallTrees = Mapping[str, List[Any]]


class VroomTimeout(Exception):
    pass


@instrumented_task(  # type: ignore
    name="sentry.profiles.task.process_profile",
    queue="profiles.process",
    autoretry_for=(VroomTimeout,),  # Retry when vroom returns a GCS timeout
    retry_backoff=True,
    retry_backoff_max=60,  # up to 1 min
    retry_jitter=True,
    default_retry_delay=5,  # retries after 5s
    max_retries=5,
    acks_late=True,
    task_time_limit=60,
    task_acks_on_failure_or_timeout=False,
)
def process_profile_task(
    profile: Optional[Profile] = None,
    payload: Any = None,
    **kwargs: Any,
) -> None:
    if payload:
        message_dict = msgpack.unpackb(payload, use_list=False)
        profile = json.loads(message_dict["payload"], use_rapid_json=True)

        assert profile is not None

        profile.update(
            {
                "organization_id": message_dict["organization_id"],
                "project_id": message_dict["project_id"],
                "received": message_dict["received"],
            }
        )

    assert profile is not None

    organization = Organization.objects.get_from_cache(id=profile["organization_id"])

    sentry_sdk.set_tag("organization", organization.id)
    sentry_sdk.set_tag("organization.slug", organization.slug)

    project = Project.objects.get_from_cache(id=profile["project_id"])

    sentry_sdk.set_tag("project", project.id)
    sentry_sdk.set_tag("project.slug", project.slug)

    event_id = profile["event_id"] if "event_id" in profile else profile["profile_id"]
    if "event_id" not in profile:
        profile["event_id"] = event_id

    sentry_sdk.set_context(
        "profile_metadata",
        {
            "organization_id": profile["organization_id"],
            "project_id": profile["project_id"],
            "profile_id": event_id,
        },
    )

    sentry_sdk.set_tag("platform", profile["platform"])
    sentry_sdk.set_tag("format", "sample" if "version" in profile else "legacy")

    if not _symbolicate_profile(profile, project):
        return

    if not _deobfuscate_profile(profile, project):
        return

    if not _normalize_profile(profile, organization, project):
        return

    if not _push_profile_to_vroom(profile, project):
        return

    _track_outcome(profile=profile, project=project, outcome=Outcome.ACCEPTED)


JS_PLATFORMS = ["javascript", "node"]
SHOULD_SYMBOLICATE_JS = frozenset(JS_PLATFORMS)
SHOULD_SYMBOLICATE = frozenset(["cocoa", "rust"] + JS_PLATFORMS)
SHOULD_DEOBFUSCATE = frozenset(["android"])


def _should_symbolicate(profile: Profile) -> bool:
    platform: str = profile["platform"]
    return platform in SHOULD_SYMBOLICATE and not profile.get("processed_by_symbolicator", False)


def _should_deobfuscate(profile: Profile) -> bool:
    platform: str = profile["platform"]
    return platform in SHOULD_DEOBFUSCATE and not profile.get("deobfuscated", False)


def _symbolicate_profile(profile: Profile, project: Project) -> bool:
    if not _should_symbolicate(profile):
        return True

    with sentry_sdk.start_span(op="task.profiling.symbolicate"):
        try:
            if "debug_meta" not in profile or not profile["debug_meta"]:
                metrics.incr(
                    "process_profile.missing_keys.debug_meta",
                    tags={"platform": profile["platform"]},
                    sample_rate=1.0,
                )
                return True

            # WARNING(loewenheim): This function call may mutate `profile`'s frame list!
            # See comments in the function for why this happens.
            raw_modules, raw_stacktraces, frames_sent = _prepare_frames_from_profile(profile)
            modules, stacktraces, success = run_symbolicate(
                project=project,
                profile=profile,
                modules=raw_modules,
                stacktraces=raw_stacktraces,
            )

            if success:
                _process_symbolicator_results(
                    profile=profile,
                    modules=modules,
                    stacktraces=stacktraces,
                    frames_sent=frames_sent,
                )

            profile["processed_by_symbolicator"] = True
            return True
        except Exception as e:
            sentry_sdk.capture_exception(e)
            metrics.incr("process_profile.symbolicate.error", sample_rate=1.0)
            _track_outcome(
                profile=profile,
                project=project,
                outcome=Outcome.INVALID,
                reason="profiling_failed_symbolication",
            )
            return False


def _deobfuscate_profile(profile: Profile, project: Project) -> bool:
    if not _should_deobfuscate(profile):
        return True

    with sentry_sdk.start_span(op="task.profiling.deobfuscate"):
        try:
            if "profile" not in profile or not profile["profile"]:
                metrics.incr(
                    "process_profile.missing_keys.profile",
                    tags={"platform": profile["platform"]},
                    sample_rate=1.0,
                )
                return True

            _deobfuscate(profile=profile, project=project)
            profile["deobfuscated"] = True
            return True
        except Exception as e:
            sentry_sdk.capture_exception(e)
            _track_outcome(
                profile=profile,
                project=project,
                outcome=Outcome.INVALID,
                reason="profiling_failed_deobfuscation",
            )
            return False


def _normalize_profile(profile: Profile, organization: Organization, project: Project) -> bool:
    if profile.get("normalized", False):
        return True

    with sentry_sdk.start_span(op="task.profiling.normalize"):
        try:
            _normalize(profile=profile, organization=organization)
            profile["normalized"] = True
            return True
        except Exception as e:
            sentry_sdk.capture_exception(e)
            _track_outcome(
                profile=profile,
                project=project,
                outcome=Outcome.INVALID,
                reason="profiling_failed_normalization",
            )
            return False


@metrics.wraps("process_profile.normalize")
def _normalize(profile: Profile, organization: Organization) -> None:
    profile["retention_days"] = quotas.get_event_retention(organization=organization) or 90

    if profile["platform"] in {"cocoa", "android"}:
        classification_options = dict()

        if profile["platform"] == "android":
            classification_options.update(
                {
                    "cpu_frequencies": profile["device_cpu_frequencies"],
                    "physical_memory_bytes": profile["device_physical_memory_bytes"],
                }
            )

        if "version" in profile:
            device_options = {
                "model": profile["device"]["model"],
                "os_name": profile["os"]["name"],
                "is_emulator": profile["device"]["is_emulator"],
            }
        else:
            device_options = {
                "model": profile["device_model"],
                "os_name": profile["device_os_name"],
                "is_emulator": profile["device_is_emulator"],
            }

        classification_options.update(device_options)
        classification = str(classify_device(**classification_options))

        if "version" in profile:
            profile["device"]["classification"] = classification
        else:
            profile["device_classification"] = classification


def _prepare_frames_from_profile(profile: Profile) -> Tuple[List[Any], List[Any], set[int]]:
    with sentry_sdk.start_span(op="task.profiling.symbolicate.prepare_frames"):
        modules = profile["debug_meta"]["images"]
        frames: List[Any] = []
        frames_sent: set[int] = set()

        # NOTE: the usage of `adjust_instruction_addr` assumes that all
        # the profilers on all the platforms are walking stacks right from a
        # suspended threads cpu context

        # in the sample format, we have a frames key containing all the frames
        if "version" in profile:
            if profile["platform"] in JS_PLATFORMS:
                for idx, f in enumerate(profile["profile"]["frames"]):
                    if is_valid_javascript_frame(f, profile):
                        frames_sent.add(idx)

                frames = [profile["profile"]["frames"][idx] for idx in frames_sent]
            else:
                frames = profile["profile"]["frames"]

                for stack in profile["profile"]["stacks"]:
                    if len(stack) > 0:
                        # Make a deep copy of the leaf frame with adjust_instruction_addr = False
                        # and append it to the list. This ensures correct behavior
                        # if the leaf frame also shows up in the middle of another stack.
                        first_frame_idx = stack[0]
                        frame = deepcopy(frames[first_frame_idx])
                        frame["adjust_instruction_addr"] = False
                        frames.append(frame)
                        stack[0] = len(frames) - 1

            stacktraces = [{"frames": frames}]
        # in the original format, we need to gather frames from all samples
        else:
            stacktraces = []
            for s in profile["sampled_profile"]["samples"]:
                frames = s["frames"]

                if len(frames) > 0:
                    frames[0]["adjust_instruction_addr"] = False

                stacktraces.append(
                    {
                        "frames": frames,
                    }
                )
        return (modules, stacktraces, frames_sent)


def symbolicate(
    symbolicator: Symbolicator, profile: Profile, modules: List[Any], stacktraces: List[Any]
) -> Any:
    if profile["platform"] in SHOULD_SYMBOLICATE_JS:
        return process_js_stacktraces(
            symbolicator=symbolicator,
            profile=profile,
            modules=modules,
            stacktraces=stacktraces,
            apply_source_context=False,
        )
    return symbolicator.process_payload(
        stacktraces=stacktraces, modules=modules, apply_source_context=False
    )


@metrics.wraps("process_profile.symbolicate.request")
def run_symbolicate(
    project: Project,
    profile: Profile,
    modules: List[Any],
    stacktraces: List[Any],
) -> Tuple[List[Any], List[Any], bool]:
    symbolicator = Symbolicator(SymbolicatorTaskKind(), project, profile["event_id"])
    symbolication_start_time = time()

    while True:
        try:
            with sentry_sdk.start_span(op="task.profiling.symbolicate.process_payload"):
                response = symbolicate(
                    symbolicator=symbolicator,
                    profile=profile,
                    stacktraces=stacktraces,
                    modules=modules,
                )

                if not response:
                    profile["symbolicator_error"] = {
                        "type": EventError.NATIVE_INTERNAL_FAILURE,
                    }
                    return modules, stacktraces, False
                elif response["status"] == "completed":
                    return (
                        response.get("modules", modules),
                        response.get("stacktraces", stacktraces),
                        True,
                    )
                elif response["status"] == "failed":
                    profile["symbolicator_error"] = {
                        "type": EventError.NATIVE_SYMBOLICATOR_FAILED,
                        "status": response.get("status"),
                        "message": response.get("message"),
                    }
                    return modules, stacktraces, False
                else:
                    profile["symbolicator_error"] = {
                        "status": response.get("status"),
                        "type": EventError.NATIVE_INTERNAL_FAILURE,
                    }
                    return modules, stacktraces, False
        except RetrySymbolication as e:
            if (
                time() - symbolication_start_time
            ) > settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT:
                metrics.incr("process_profile.symbolicate.timeout", sample_rate=1.0)
                break
            else:
                sleep_time = (
                    settings.SYMBOLICATOR_MAX_RETRY_AFTER
                    if e.retry_after is None
                    else min(e.retry_after, settings.SYMBOLICATOR_MAX_RETRY_AFTER)
                )
                sleep(sleep_time)
                continue

    # returns the unsymbolicated data to avoid errors later
    return modules, stacktraces, False


@metrics.wraps("process_profile.symbolicate.process")
def _process_symbolicator_results(
    profile: Profile,
    modules: List[Any],
    stacktraces: List[Any],
    frames_sent: set[int],
) -> None:
    with sentry_sdk.start_span(op="task.profiling.symbolicate.process_results"):
        # update images with status after symbolication
        profile["debug_meta"]["images"] = modules

        if "version" in profile:
            _process_symbolicator_results_for_sample(
                profile,
                stacktraces,
                frames_sent,
            )
            return

        if profile["platform"] == "rust":
            _process_symbolicator_results_for_rust(profile, stacktraces)
        elif profile["platform"] == "cocoa":
            _process_symbolicator_results_for_cocoa(profile, stacktraces)

        # rename the profile key to suggest it has been processed
        profile["profile"] = profile.pop("sampled_profile")


def _process_symbolicator_results_for_sample(
    profile: Profile, stacktraces: List[Any], frames_sent: set[int]
) -> None:
    if profile["platform"] == "rust":

        def truncate_stack_needed(frames: List[dict[str, Any]], stack: List[Any]) -> List[Any]:
            # remove top frames related to the profiler (top of the stack)
            if frames[stack[0]].get("function", "") == "perf_signal_handler":
                stack = stack[2:]
            # remove unsymbolicated frames before the runtime calls (bottom of the stack)
            if frames[stack[len(stack) - 2]].get("function", "") == "":
                stack = stack[:-2]
            return stack

    elif profile["platform"] == "cocoa":

        def truncate_stack_needed(
            frames: List[dict[str, Any]],
            stack: List[Any],
        ) -> List[Any]:
            # remove bottom frames we can't symbolicate
            if frames[-1].get("instruction_addr", "") == "0xffffffffc":
                return stack[:-2]
            return stack

    else:

        def truncate_stack_needed(
            frames: List[dict[str, Any]],
            stack: List[Any],
        ) -> List[Any]:
            return stack

    symbolicated_frames = stacktraces[0]["frames"]
    symbolicated_frames_dict = get_frame_index_map(symbolicated_frames)

    if len(frames_sent) > 0:
        raw_frames = profile["profile"]["frames"]
        new_frames = []

        for idx in range(len(raw_frames)):
            if idx in frames_sent:
                for frame_idx in symbolicated_frames_dict[idx]:
                    new_frames.append(symbolicated_frames[frame_idx])
            else:
                new_frames.append(raw_frames[idx])

        new_frames_count = (
            len(raw_frames)
            - len(symbolicated_frames_dict)
            + sum([len(frames) for frames in symbolicated_frames_dict.values()])
        )

        assert len(new_frames) == new_frames_count

        profile["profile"]["frames"] = new_frames
    else:
        profile["profile"]["frames"] = symbolicated_frames

    if profile["platform"] in SHOULD_SYMBOLICATE:

        def get_stack(stack: List[int]) -> List[int]:
            new_stack: List[int] = []
            for index in stack:
                if index in symbolicated_frames_dict:
                    # the new stack extends the older by replacing
                    # a specific frame index with the indices of
                    # the frames originated from the original frame
                    # should inlines be present                    # should inlines be present
                    new_stack.extend(symbolicated_frames_dict[index])
                else:
                    new_stack.append(index)
            return new_stack

    else:

        def get_stack(stack: List[int]) -> List[int]:
            return stack

    stacks = []

    for stack in profile["profile"]["stacks"]:
        new_stack = get_stack(stack)

        if len(new_stack) >= 2:
            # truncate some unneeded frames in the stack (related to the profiler itself or impossible to symbolicate)
            new_stack = truncate_stack_needed(profile["profile"]["frames"], new_stack)

        stacks.append(new_stack)

    profile["profile"]["stacks"] = stacks


def _process_symbolicator_results_for_cocoa(profile: Profile, stacktraces: List[Any]) -> None:
    for original, symbolicated in zip(profile["sampled_profile"]["samples"], stacktraces):
        # remove bottom frames we can't symbolicate
        if (
            len(symbolicated["frames"]) > 1
            and symbolicated["frames"][-1].get("instruction_addr", "") == "0xffffffffc"
        ):
            original["frames"] = symbolicated["frames"][:-2]
        else:
            original["frames"] = symbolicated["frames"]


def _process_symbolicator_results_for_rust(profile: Profile, stacktraces: List[Any]) -> None:
    for original, symbolicated in zip(profile["sampled_profile"]["samples"], stacktraces):
        for frame in symbolicated["frames"]:
            frame.pop("pre_context", None)
            frame.pop("context_line", None)
            frame.pop("post_context", None)

        # exclude the top frames of the stack as it's related to the profiler itself and we don't want them.
        if (
            len(symbolicated["frames"]) > 1
            and symbolicated["frames"][0].get("function", "") == "perf_signal_handler"
        ):
            original["frames"] = symbolicated["frames"][2:]
        else:
            original["frames"] = symbolicated["frames"]


"""
This function returns a map {index: [indexes]} that will let us replace a specific
frame index with (potentially) a list of frames indices that originated from that frame.

The reason for this is that the frame from the SDK exists "physically",
and symbolicator then synthesizes other frames for calls that have been inlined
into the physical frame.

Example:

`
fn a() {
b()
}
fb b() {
fn c_inlined() {}
c_inlined()
}
`

this would yield the following from the SDK:
b -> a

after symbolication you would have:
c_inlined -> b -> a

The sorting order is callee to caller (child to parent)
"""


def get_frame_index_map(frames: List[dict[str, Any]]) -> dict[int, List[int]]:
    index_map: dict[int, List[int]] = {}
    for i, frame in enumerate(frames):
        index_map.setdefault(frame.get("original_index", i), []).append(i)
    return index_map


@metrics.wraps("process_profile.deobfuscate")
def _deobfuscate(profile: Profile, project: Project) -> None:
    debug_file_id = profile.get("build_id")
    if debug_file_id is None or debug_file_id == "":
        return

    with sentry_sdk.start_span(op="proguard.fetch_debug_files"):
        dif_paths = ProjectDebugFile.difcache.fetch_difs(
            project, [debug_file_id], features=["mapping"]
        )
        debug_file_path = dif_paths.get(debug_file_id)
        if debug_file_path is None:
            return

    with sentry_sdk.start_span(op="proguard.open"):
        mapper = ProguardMapper.open(debug_file_path)
        if not mapper.has_line_info:
            return

    with sentry_sdk.start_span(op="proguard.remap"):
        for method in profile["profile"]["methods"]:
            mapped = mapper.remap_frame(
                method["class_name"], method["name"], method["source_line"] or 0
            )
            if len(mapped) == 1:
                new_frame = mapped[0]
                method.update(
                    {
                        "class_name": new_frame.class_name,
                        "name": new_frame.method,
                        "source_file": new_frame.file,
                        "source_line": new_frame.line,
                    }
                )
            elif len(mapped) > 1:
                bottom_class = mapped[-1].class_name
                method["inline_frames"] = [
                    {
                        "class_name": new_frame.class_name,
                        "name": new_frame.method,
                        "source_file": method["source_file"]
                        if bottom_class == new_frame.class_name
                        else None,
                        "source_line": new_frame.line,
                    }
                    for new_frame in mapped
                ]
            else:
                mapped = mapper.remap_class(method["class_name"])
                if mapped:
                    method["class_name"] = mapped


@metrics.wraps("process_profile.track_outcome")
def _track_outcome(
    profile: Profile,
    project: Project,
    outcome: Outcome,
    reason: Optional[str] = None,
) -> None:
    if not project.flags.has_profiles:
        first_profile_received.send_robust(project=project, sender=Project)

    if "transaction_id" in profile:
        event_id = profile["transaction_id"]
    else:
        event_id = profile["event_id"]

    track_outcome(
        org_id=project.organization_id,
        project_id=project.id,
        key_id=None,
        outcome=outcome,
        reason=reason,
        timestamp=datetime.utcnow().replace(tzinfo=UTC),
        event_id=event_id,
        category=DataCategory.PROFILE_INDEXED,
        quantity=1,
    )


@metrics.wraps("process_profile.insert_vroom_profile")
def _insert_vroom_profile(profile: Profile) -> bool:
    with sentry_sdk.start_span(op="task.profiling.insert_vroom"):
        try:
            response = get_from_profiling_service(method="POST", path="/profile", json_data=profile)

            if response.status == 204:
                return True
            elif response.status == 429:
                raise VroomTimeout
            else:
                metrics.incr(
                    "process_profile.insert_vroom_profile.error",
                    tags={"platform": profile["platform"], "reason": "bad status"},
                    sample_rate=1.0,
                )
                return False
        except VroomTimeout:
            raise
        except Exception as e:
            sentry_sdk.capture_exception(e)
            metrics.incr(
                "process_profile.insert_vroom_profile.error",
                tags={"platform": profile["platform"], "reason": "encountered error"},
                sample_rate=1.0,
            )
            return False


def _push_profile_to_vroom(profile: Profile, project: Project) -> bool:
    if _insert_vroom_profile(profile=profile):
        return True

    _track_outcome(
        profile=profile,
        project=project,
        outcome=Outcome.INVALID,
        reason="profiling_failed_vroom_insertion",
    )
    return False


def process_js_stacktraces(
    symbolicator: Symbolicator,
    profile: Profile,
    modules: List[Any],
    stacktraces: List[Any],
    apply_source_context: bool = False,
) -> Any:
    project = symbolicator.project
    return symbolicator.process_js(
        stacktraces=stacktraces,
        modules=modules,
        release=profile.get("release"),
        dist=profile.get("dist"),
        scraping_config=generate_scraping_config(project),
        apply_source_context=apply_source_context,
    )
