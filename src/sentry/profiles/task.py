from __future__ import annotations

from datetime import datetime
from time import sleep, time
from typing import Any, List, Mapping, MutableMapping, Optional, Tuple

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload, KafkaProducer
from arroyo.types import Topic
from django.conf import settings
from django.utils import timezone
from pytz import UTC
from symbolic import ProguardMapper  # type: ignore

from sentry import quotas
from sentry.constants import DataCategory
from sentry.lang.native.symbolicator import Symbolicator
from sentry.models import Organization, Project, ProjectDebugFile
from sentry.profiles.device import classify_device
from sentry.profiles.utils import get_from_profiling_service
from sentry.signals import first_profile_received
from sentry.tasks.base import instrumented_task
from sentry.tasks.symbolication import RetrySymbolication
from sentry.utils import json, kafka_config, metrics
from sentry.utils.outcomes import Outcome, track_outcome

Profile = MutableMapping[str, Any]
CallTrees = Mapping[str, List[Any]]

_profiles_kafka_producer = None


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
)
def process_profile_task(
    profile: Profile,
    **kwargs: Any,
) -> None:
    project = Project.objects.get_from_cache(id=profile["project_id"])
    event_id = profile["event_id"] if "event_id" in profile else profile["profile_id"]

    sentry_sdk.set_context(
        "profile",
        {
            "organization_id": profile["organization_id"],
            "project_id": profile["project_id"],
            "profile_id": event_id,
        },
    )
    sentry_sdk.set_tag("platform", profile["platform"])

    try:
        if _should_symbolicate(profile):
            if "debug_meta" not in profile or not profile["debug_meta"]:
                metrics.incr(
                    "process_profile.missing_keys.debug_meta",
                    tags={"platform": profile["platform"]},
                    sample_rate=1.0,
                )
                return

            raw_modules, raw_stacktraces = _prepare_frames_from_profile(profile)
            modules, stacktraces = _symbolicate(
                project=project,
                profile_id=event_id,
                modules=raw_modules,
                stacktraces=raw_stacktraces,
            )

            try:
                raw_counts = [len(stacktrace["frames"]) for stacktrace in raw_stacktraces]
                counts = [len(stacktrace["frames"]) for stacktrace in stacktraces]
                if len(raw_counts) != len(counts) or any(a > b for a, b in zip(raw_counts, counts)):
                    with sentry_sdk.push_scope() as scope:
                        scope.set_context(
                            "profile_stacktraces",
                            {
                                "raw_stacktraces_count": raw_counts,
                                "raw_stacktraces": raw_stacktraces,
                                "stacktraces_count": counts,
                                "stacktraces": stacktraces,
                            },
                        )
                        sentry_sdk.capture_message(
                            "Symbolicator returned less stacks than expected"
                        )
            except Exception as e:
                sentry_sdk.capture_exception(e)

            _process_symbolicator_results(profile=profile, modules=modules, stacktraces=stacktraces)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        metrics.incr("process_profile.symbolicate.error", sample_rate=1.0)
        _track_outcome(
            profile=profile,
            project=project,
            outcome=Outcome.INVALID,
            reason="profiling_failed_symbolication",
        )
        return

    try:
        if _should_deobfuscate(profile):
            if "profile" not in profile or not profile["profile"]:
                metrics.incr(
                    "process_profile.missing_keys.profile",
                    tags={"platform": profile["platform"]},
                    sample_rate=1.0,
                )
                return

            _deobfuscate(profile=profile, project=project)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        _track_outcome(
            profile=profile,
            project=project,
            outcome=Outcome.INVALID,
            reason="profiling_failed_deobfuscation",
        )
        return

    organization = Organization.objects.get_from_cache(id=project.organization_id)

    try:
        _normalize(profile=profile, organization=organization)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        _track_outcome(
            profile=profile,
            project=project,
            outcome=Outcome.INVALID,
            reason="profiling_failed_normalization",
        )
        return

    if not _insert_vroom_profile(profile=profile):
        _track_outcome(
            profile=profile,
            project=project,
            outcome=Outcome.INVALID,
            reason="profiling_failed_vroom_insertion",
        )
        return

    _initialize_producer()

    try:
        _insert_eventstream_call_tree(profile=profile)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        _track_outcome(
            profile=profile,
            project=project,
            outcome=Outcome.INVALID,
            reason="failed-to-produce-functions",
        )
        return

    try:
        _insert_eventstream_profile(profile=profile)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        _track_outcome(
            profile=profile,
            project=project,
            outcome=Outcome.INVALID,
            reason="failed-to-produce-metadata",
        )
        return

    _track_outcome(profile=profile, project=project, outcome=Outcome.ACCEPTED)


SHOULD_SYMBOLICATE = frozenset(["cocoa", "rust"])
SHOULD_DEOBFUSCATE = frozenset(["android"])


def _should_symbolicate(profile: Profile) -> bool:
    platform: str = profile["platform"]
    return platform in SHOULD_SYMBOLICATE


def _should_deobfuscate(profile: Profile) -> bool:
    platform: str = profile["platform"]
    return platform in SHOULD_DEOBFUSCATE


@metrics.wraps("process_profile.normalize")
def _normalize(profile: Profile, organization: Organization) -> None:
    profile["retention_days"] = quotas.get_event_retention(organization=organization)

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


def _prepare_frames_from_profile(profile: Profile) -> Tuple[List[Any], List[Any]]:
    modules = profile["debug_meta"]["images"]

    # in the sample format, we have a frames key containing all the frames
    if "version" in profile:
        stacktraces = [{"registers": {}, "frames": profile["profile"]["frames"]}]
    # in the original format, we need to gather frames from all samples
    else:
        stacktraces = [
            {
                "registers": {},
                "frames": s["frames"],
            }
            for s in profile["sampled_profile"]["samples"]
        ]
    return (modules, stacktraces)


@metrics.wraps("process_profile.symbolicate.request")
def _symbolicate(
    project: Project, profile_id: str, modules: List[Any], stacktraces: List[Any]
) -> Tuple[List[Any], List[Any]]:
    symbolicator = Symbolicator(project=project, event_id=profile_id)
    symbolication_start_time = time()

    while True:
        try:
            response = symbolicator.process_payload(stacktraces=stacktraces, modules=modules)
            return (response.get("modules", modules), response.get("stacktraces", stacktraces))
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
    return (modules, stacktraces)


@metrics.wraps("process_profile.symbolicate.process")
def _process_symbolicator_results(
    profile: Profile, modules: List[Any], stacktraces: List[Any]
) -> None:
    # update images with status after symbolication
    profile["debug_meta"]["images"] = modules

    if "version" in profile:
        _process_symbolicator_results_for_sample(profile, stacktraces)
        return

    if profile["platform"] == "rust":
        _process_symbolicator_results_for_rust(profile, stacktraces)
    elif profile["platform"] == "cocoa":
        _process_symbolicator_results_for_cocoa(profile, stacktraces)

    # rename the profile key to suggest it has been processed
    profile["profile"] = profile.pop("sampled_profile")


def _process_symbolicator_results_for_sample(profile: Profile, stacktraces: List[Any]) -> None:
    profile["profile"]["frames"] = stacktraces[0]["frames"]
    if profile["platform"] in SHOULD_SYMBOLICATE:
        for frame in profile["profile"]["frames"]:
            frame.pop("pre_context", None)
            frame.pop("context_line", None)
            frame.pop("post_context", None)

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

    if profile["platform"] in SHOULD_SYMBOLICATE:
        idx_map = get_frame_index_map(profile["profile"]["frames"])

        def get_stack(stack: List[int]) -> List[int]:
            new_stack: List[int] = []
            for index in stack:
                # the new stack extends the older by replacing
                # a specific frame index with the indices of
                # the frames originated from the original frame
                # should inlines be present
                new_stack.extend(idx_map[index])
            return new_stack

    else:

        def get_stack(stack: List[int]) -> List[int]:
            return stack

    for sample in profile["profile"]["samples"]:
        stack_id = sample["stack_id"]
        stack = get_stack(profile["profile"]["stacks"][stack_id])
        profile["profile"]["stacks"][stack_id] = stack

        if len(stack) < 2:
            continue

        # truncate some unneeded frames in the stack (related to the profiler itself or impossible to symbolicate)
        profile["profile"]["stacks"][stack_id] = truncate_stack_needed(
            profile["profile"]["frames"], stack
        )


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
        original_idx = frame["original_index"]
        idx_list = index_map.get(original_idx, [])
        idx_list.append(i)
        index_map[original_idx] = idx_list
    return index_map


@metrics.wraps("process_profile.deobfuscate")
def _deobfuscate(profile: Profile, project: Project) -> None:
    debug_file_id = profile.get("build_id")
    if debug_file_id is None or debug_file_id == "":
        return

    dif_paths = ProjectDebugFile.difcache.fetch_difs(project, [debug_file_id], features=["mapping"])
    debug_file_path = dif_paths.get(debug_file_id)
    if debug_file_path is None:
        return

    mapper = ProguardMapper.open(debug_file_path)
    if not mapper.has_line_info:
        return

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
        category=DataCategory.PROFILE,
        quantity=1,
    )


@metrics.wraps("process_profile.initialize_producer")
def _initialize_producer() -> None:
    global _profiles_kafka_producer

    if _profiles_kafka_producer is None:
        config = settings.KAFKA_TOPICS[settings.KAFKA_PROFILES]
        _profiles_kafka_producer = KafkaProducer(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"]),
        )


@metrics.wraps("process_profile.insert_eventstream.profile")
def _insert_eventstream_profile(profile: Profile) -> None:
    """
    TODO: This function directly publishes the profile to kafka.
    We'll want to look into the existing eventstream abstraction
    so we can take advantage of nodestore at some point for single
    profile access.
    """

    # just a guard as this should always be initialized already
    if _profiles_kafka_producer is None:
        return

    f = _profiles_kafka_producer.produce(
        Topic(name="processed-profiles"),
        KafkaPayload(key=None, value=json.dumps(profile).encode("utf-8"), headers=[]),
    )
    f.exception()


@metrics.wraps("process_profile.insert_eventstream.call_tree")
def _insert_eventstream_call_tree(profile: Profile) -> None:
    # just a guard as this should always be initialized already
    if _profiles_kafka_producer is None:
        return

    # call_trees is empty because of an error earlier, skip aggregation
    if not profile.get("call_trees"):
        return

    try:
        if "version" in profile:
            event = _get_event_instance_for_sample(profile)
        else:
            event = _get_event_instance_for_legacy(profile)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return
    finally:
        # Assumes that the call tree is inserted into the
        # event stream before the profile is inserted into
        # the event stream.
        #
        # After inserting the call tree, we no longer need
        # it, but if we don't delete it here, it will be
        # inserted in the profile payload making it larger
        # and slower.
        del profile["call_trees"]

    f = _profiles_kafka_producer.produce(
        Topic(name="profiles-call-tree"),
        KafkaPayload(key=None, value=json.dumps(event).encode("utf-8"), headers=[]),
    )
    f.exception()


@metrics.wraps("process_profile.get_event_instance")
def _get_event_instance_for_sample(profile: Profile) -> Any:
    return {
        "call_trees": profile["call_trees"],
        "environment": profile.get("environment"),
        "os_name": profile["os"]["name"],
        "os_version": profile["os"]["version"],
        "platform": profile["platform"],
        "profile_id": profile["event_id"],
        "project_id": profile["project_id"],
        "release": profile["release"],
        "retention_days": profile["retention_days"],
        "timestamp": profile["received"],
        "transaction_name": profile["transactions"][0]["name"],
    }


@metrics.wraps("process_profile.get_event_instance")
def _get_event_instance_for_legacy(profile: Profile) -> Any:
    return {
        "call_trees": profile["call_trees"],
        "environment": profile.get("environment"),
        "os_name": profile["device_os_name"],
        "os_version": profile["device_os_version"],
        "platform": profile["platform"],
        "profile_id": profile["profile_id"],
        "project_id": profile["project_id"],
        "release": f"{profile['version_name']} ({profile['version_code']})"
        if profile["version_code"]
        else profile["version_name"],
        "retention_days": profile["retention_days"],
        "timestamp": profile["received"],
        "transaction_name": profile["transaction_name"],
    }


@metrics.wraps("process_profile.insert_vroom_profile")
def _insert_vroom_profile(profile: Profile) -> bool:
    original_timestamp = profile["received"]

    try:
        profile["received"] = (
            datetime.utcfromtimestamp(profile["received"]).replace(tzinfo=timezone.utc).isoformat()
        )

        response = get_from_profiling_service(method="POST", path="/profile", json_data=profile)

        if response.status == 204:
            profile["call_trees"] = {}
        elif response.status == 200:
            profile["call_trees"] = json.loads(response.data, use_rapid_json=True)["call_trees"]
        elif response.status == 429:
            raise VroomTimeout
        else:
            metrics.incr(
                "process_profile.insert_vroom_profile.error",
                tags={"platform": profile["platform"], "reason": "bad status"},
                sample_rate=1.0,
            )
            return False
        return True
    except RecursionError as e:
        sentry_sdk.capture_exception(e)
        return True
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
    finally:
        profile["received"] = original_timestamp

        # remove keys we don't need anymore for snuba
        for k in {"profile", "debug_meta"}:
            profile.pop(k, None)
