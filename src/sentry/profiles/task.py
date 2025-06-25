from __future__ import annotations

import io
import logging
import zlib
from base64 import b64decode, b64encode
from copy import deepcopy
from datetime import datetime, timezone
from operator import itemgetter
from time import time
from typing import Any, TypedDict
from uuid import UUID

import msgpack
import sentry_sdk
import vroomrs
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings
from packaging.version import InvalidVersion
from packaging.version import parse as parse_version

from sentry import features, options, quotas
from sentry.conf.types.kafka_definition import Topic
from sentry.constants import DataCategory
from sentry.lang.javascript.processing import _handles_frame as is_valid_javascript_frame
from sentry.lang.native.processing import _merge_image
from sentry.lang.native.symbolicator import Symbolicator, SymbolicatorPlatform, SymbolicatorTaskKind
from sentry.lang.native.utils import native_images_from_data
from sentry.models.eventerror import EventError
from sentry.models.files.utils import get_profiles_storage
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectsdk import EventType, ProjectSDK, get_minimum_sdk_version
from sentry.profiles.java import (
    convert_android_methods_to_jvm_frames,
    deobfuscate_signature,
    format_signature,
    merge_jvm_frames_with_android_methods,
)
from sentry.profiles.utils import (
    Profile,
    apply_stack_trace_rules_to_profile,
    get_from_profiling_service,
)
from sentry.search.utils import DEVICE_CLASS
from sentry.signals import first_profile_received
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import ingest_profiling_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import json, metrics
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.projectflags import set_project_flag_and_signal
from sentry.utils.sdk import set_span_attribute

REVERSE_DEVICE_CLASS = {next(iter(tags)): label for label, tags in DEVICE_CLASS.items()}

# chunks are 1 min max with additional 10% buffer
MAX_DURATION_SAMPLE_V2 = 66000

UI_PROFILE_PLATFORMS = {"cocoa", "android", "javascript"}


def _get_profiles_producer_from_topic(topic: Topic) -> KafkaProducer:
    cluster_name = get_topic_definition(topic)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


processed_profiles_producer = SingletonProducer(
    lambda: _get_profiles_producer_from_topic(Topic.PROCESSED_PROFILES),
    max_futures=settings.SENTRY_PROCESSED_PROFILES_FUTURES_MAX_LIMIT,
)

profile_functions_producer = SingletonProducer(
    lambda: _get_profiles_producer_from_topic(Topic.PROFILES_CALL_TREE),
    max_futures=settings.SENTRY_PROFILE_FUNCTIONS_FUTURES_MAX_LIMIT,
)

profile_chunks_producer = SingletonProducer(
    lambda: _get_profiles_producer_from_topic(Topic.PROFILE_CHUNKS),
    max_futures=settings.SENTRY_PROFILE_CHUNKS_FUTURES_MAX_LIMIT,
)

logger = logging.getLogger(__name__)


def decode_payload(encoded: str) -> dict[str, Any]:
    try:
        res = msgpack.unpackb(zlib.decompress(b64decode(encoded.encode("utf-8"))), use_list=False)
        metrics.incr("profiling.profile_metrics.decompress", tags={"status": "ok"})
        return res
    except Exception as e:
        logger.exception("Failed to decompress compressed profile", extra={"error": e})
        metrics.incr("profiling.profile_metrics.decompress", tags={"status": "err"})
        raise


def encode_payload(message: dict[str, Any]) -> str:
    return b64encode(
        zlib.compress(
            msgpack.packb(message),
            level=1,
        )
    ).decode("utf-8")


@instrumented_task(
    name="sentry.profiles.task.process_profile",
    retry_backoff=True,
    retry_backoff_max=20,
    retry_jitter=True,
    default_retry_delay=5,  # retries after 5s
    max_retries=2,
    acks_late=True,
    task_time_limit=60,
    task_acks_on_failure_or_timeout=False,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=ingest_profiling_tasks,
        processing_deadline_duration=60,
        retry=Retry(
            times=2,
            delay=5,
        ),
    ),
)
def process_profile_task(
    profile: Profile | None = None,
    payload: str | None = None,
    sampled: bool = True,
    **kwargs: Any,
) -> None:
    if not sampled and not options.get("profiling.profile_metrics.unsampled_profiles.enabled"):
        return

    if payload:
        message_dict = decode_payload(payload)

        profile = json.loads(message_dict["payload"], use_rapid_json=True)

        assert profile is not None

        profile.update(
            {
                "organization_id": message_dict["organization_id"],
                "project_id": message_dict["project_id"],
                "received": message_dict["received"],
                "sampled": sampled,
            }
        )

    assert profile is not None

    if not sampled:
        metrics.incr(
            "process_profile.unsampled_profiles",
            tags={"platform": profile["platform"]},
        )

    organization = Organization.objects.get_from_cache(id=profile["organization_id"])

    sentry_sdk.set_tag("organization", organization.id)
    sentry_sdk.set_tag("organization.slug", organization.slug)

    project = Project.objects.get_from_cache(id=profile["project_id"])

    sentry_sdk.set_tag("project", project.id)
    sentry_sdk.set_tag("project.slug", project.slug)

    if sampled and _is_deprecated(profile, project, organization):
        return

    profile_context = {
        "organization_id": profile["organization_id"],
        "project_id": profile["project_id"],
    }

    if "profile_id" in profile:
        profile["event_id"] = profile["profile_id"]

    if "event_id" in profile:
        profile_context["profile_id"] = profile["event_id"]
    elif "chunk_id" in profile:
        profile_context["chunk_id"] = profile["chunk_id"]

    sentry_sdk.set_context(
        "profile",
        profile_context,
    )

    sentry_sdk.set_tag("platform", profile["platform"])

    if "version" in profile:
        version = profile["version"]
        sentry_sdk.set_tag("format", f"sample_v{version}")
        set_span_attribute("profile.samples", len(profile["profile"]["samples"]))
        set_span_attribute("profile.stacks", len(profile["profile"]["stacks"]))
        set_span_attribute("profile.frames", len(profile["profile"]["frames"]))
    elif "profiler_id" in profile and profile["platform"] == "android":
        sentry_sdk.set_tag("format", "android_chunk")
    else:
        sentry_sdk.set_tag("format", "legacy")

    if not _symbolicate_profile(profile, project):
        return

    if not _deobfuscate_profile(profile, project):
        return

    if "js_profile" in profile:
        prepare_android_js_profile(profile)
        if not _symbolicate_profile(profile["js_profile"], project):
            return
        clean_android_js_profile(profile)

    if not _normalize_profile(profile, organization, project):
        return

    # set platform information at frame-level
    # only for those platforms that didn't go through symbolication
    _set_frames_platform(profile)

    if "version" in profile:
        set_span_attribute("profile.samples.processed", len(profile["profile"]["samples"]))
        set_span_attribute("profile.stacks.processed", len(profile["profile"]["stacks"]))
        set_span_attribute("profile.frames.processed", len(profile["profile"]["frames"]))

    if options.get("profiling.stack_trace_rules.enabled"):
        try:
            with metrics.timer("process_profile.apply_stack_trace_rules"):
                rules_config = project.get_option("sentry:grouping_enhancements")
                if rules_config is not None and rules_config != "":
                    apply_stack_trace_rules_to_profile(profile, rules_config)
        except Exception as e:
            sentry_sdk.capture_exception(e)

    if (
        features.has("projects:continuous-profiling-vroomrs-processing", project)
        and "profiler_id" in profile
    ):
        if not _process_vroomrs_profile(profile, project):
            return
    else:
        if not _push_profile_to_vroom(profile, project):
            return

    if sampled:
        with metrics.timer("process_profile.track_outcome.accepted"):
            set_project_flag_and_signal(project, "has_profiles", first_profile_received)
            try:
                if quotas.backend.should_emit_profile_duration_outcome(
                    organization=organization, profile=profile
                ):
                    _track_duration_outcome(profile=profile, project=project)
            except Exception as e:
                sentry_sdk.capture_exception(e)
            if "profiler_id" not in profile:
                _track_outcome(
                    profile=profile,
                    project=project,
                    outcome=Outcome.ACCEPTED,
                    categories=[DataCategory.PROFILE, DataCategory.PROFILE_INDEXED],
                )

    else:
        if "profiler_id" not in profile:
            _track_outcome(
                profile=profile,
                project=project,
                outcome=Outcome.ACCEPTED,
                categories=[DataCategory.PROFILE],
            )
            _track_outcome(
                profile=profile,
                project=project,
                outcome=Outcome.FILTERED,
                categories=[DataCategory.PROFILE_INDEXED],
                reason="sampled",
            )


def _is_deprecated(profile: Profile, project: Project, organization: Organization) -> bool:
    if not features.has("organizations:profiling-sdks", organization):
        return False

    try:
        event_type = determine_profile_type(profile)
    except UnknownProfileTypeException:
        # unsure what the profile type is but this should never happen
        # if it does happen, we should let it through because we're probably
        # not handling something correctly
        return False

    category = (
        DataCategory.PROFILE_CHUNK
        if event_type == EventType.PROFILE_CHUNK
        else DataCategory.PROFILE
    )

    try:
        sdk_name, sdk_version = determine_client_sdk(profile, event_type)
    except UnknownClientSDKException:
        _track_outcome(
            profile=profile,
            project=project,
            outcome=Outcome.FILTERED,
            categories=[category],
            reason="deprecated sdk",
        )
        return True

    try:
        ProjectSDK.update_with_newest_version_or_create(
            project=project,
            event_type=event_type,
            sdk_name=sdk_name,
            sdk_version=sdk_version,
        )
    except UnableToAcquireLock:
        # unable to acquire the lock means another event is trying to
        # update the version so we can skip the update from this event
        return False

    if not is_sdk_deprecated(event_type, sdk_name, sdk_version):
        return False

    _track_outcome(
        profile=profile,
        project=project,
        outcome=Outcome.FILTERED,
        categories=[category],
        reason="deprecated sdk",
    )

    return features.has("organizations:profiling-deprecate-sdks", organization)


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


def get_profile_platforms(profile: Profile) -> list[str]:
    platforms = [profile["platform"]]

    if "version" in profile and profile["platform"] in SHOULD_SYMBOLICATE_JS:
        for frame in profile["profile"]["frames"]:
            if frame.get("platform", "") == "cocoa":
                platforms.append(frame["platform"])
                break

    return platforms


def get_debug_images_for_platform(profile: Profile, platform: str) -> list[dict[str, Any]]:
    if platform in SHOULD_SYMBOLICATE_JS:
        return [image for image in profile["debug_meta"]["images"] if image["type"] == "sourcemap"]
    return native_images_from_data(profile)


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

            platforms = get_profile_platforms(profile)
            original_images = profile["debug_meta"]["images"]
            images = dict()
            for platform in platforms:
                images[platform] = get_debug_images_for_platform(profile, platform)

            for platform in platforms:
                profile["debug_meta"]["images"] = images[platform]
                # WARNING(loewenheim): This function call may mutate `profile`'s frame list!
                # See comments in the function for why this happens.
                raw_modules, raw_stacktraces, frames_sent = _prepare_frames_from_profile(
                    profile, platform
                )
                set_span_attribute(
                    f"profile.frames.sent.{platform}",
                    len(frames_sent),
                )

                modules, stacktraces, success = run_symbolicate(
                    project=project,
                    profile=profile,
                    modules=raw_modules,
                    stacktraces=raw_stacktraces,
                    platform=platform,
                )

                assert len(images[platform]) == len(modules)
                for raw_image, complete_image in zip(images[platform], modules):
                    _merge_image(raw_image, complete_image, None, profile)

                if success:
                    _process_symbolicator_results(
                        profile=profile,
                        modules=modules,
                        stacktraces=stacktraces,
                        frames_sent=frames_sent,
                        platform=platform,
                    )

        except Exception as e:
            sentry_sdk.capture_exception(e)
            metrics.incr("process_profile.symbolicate.error", sample_rate=1.0)
            _track_failed_outcome(profile, project, "profiling_failed_symbolication")
            return False
        profile["debug_meta"]["images"] = original_images
        profile["processed_by_symbolicator"] = True
        return True


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
            _track_failed_outcome(profile, project, "profiling_failed_deobfuscation")
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
            _track_failed_outcome(profile, project, "profiling_failed_normalization")
            return False


@metrics.wraps("process_profile.normalize")
def _normalize(profile: Profile, organization: Organization) -> None:
    profile["retention_days"] = quotas.backend.get_event_retention(organization=organization) or 90
    platform = profile["platform"]
    version = profile.get("version")

    if platform not in {"cocoa", "android"} or version == "2":
        return

    classification = profile.get("transaction_tags", {}).get("device.class", None)

    if not classification:
        return

    classification = REVERSE_DEVICE_CLASS.get(classification, "unknown")

    if version == "1":
        profile["device"]["classification"] = classification
    else:
        profile["device_classification"] = classification


def _prepare_frames_from_profile(
    profile: Profile, platform: str | None
) -> tuple[list[Any], list[Any], set[int]]:
    with sentry_sdk.start_span(op="task.profiling.symbolicate.prepare_frames"):
        modules = profile["debug_meta"]["images"]
        frames: list[Any] = []
        frames_sent: set[int] = set()

        if platform is None:
            platform = profile["platform"]

        # NOTE: the usage of `adjust_instruction_addr` assumes that all
        # the profilers on all the platforms are walking stacks right from a
        # suspended threads cpu context

        # in the sample format, we have a frames key containing all the frames
        if "version" in profile:
            if platform in JS_PLATFORMS:
                for idx, f in enumerate(profile["profile"]["frames"]):
                    if is_valid_javascript_frame(f, profile):
                        frames_sent.add(idx)

                frames = [profile["profile"]["frames"][idx] for idx in frames_sent]
            else:
                if profile["platform"] != platform:
                    # we might have both js and cocoa frames (react native)
                    # and we need to filter only for the cocoa ones
                    for idx, f in enumerate(profile["profile"]["frames"]):
                        if (
                            f.get("platform", "") == platform
                            and f.get("instruction_addr") is not None
                        ):
                            frames_sent.add(idx)
                    frames = [profile["profile"]["frames"][idx] for idx in frames_sent]
                else:
                    # if the root platform is cocoa, then we know we have only cocoa frames
                    frames = profile["profile"]["frames"]

                for stack in profile["profile"]["stacks"]:
                    if len(stack) > 0:
                        # Make a deep copy of the leaf frame with adjust_instruction_addr = False
                        # and append it to the list. This ensures correct behavior
                        # if the leaf frame also shows up in the middle of another stack.
                        first_frame_idx = stack[0]
                        frame = deepcopy(profile["profile"]["frames"][first_frame_idx])
                        frame["adjust_instruction_addr"] = False
                        if profile["platform"] not in JS_PLATFORMS:
                            frames.append(frame)
                            stack[0] = len(frames) - 1
                        else:
                            # In case where root platform is not cocoa, but we're dealing
                            # with a cocoa stack (as in react-native), since we're relying
                            # on frames_sent instead of sending back the whole
                            # profile["profile"]["frames"], we have to append the deepcopy
                            # frame both to the original frames and to the list frames.
                            # see _process_symbolicator_results_for_sample method's logic
                            if first_frame_idx in frames_sent:
                                profile["profile"]["frames"].append(frame)
                                frames.append(frame)
                                stack[0] = len(profile["profile"]["frames"]) - 1
                                frames_sent.add(stack[0])

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
    symbolicator: Symbolicator,
    profile: Profile,
    modules: list[Any],
    stacktraces: list[Any],
    platform: str,
) -> Any:
    if platform in SHOULD_SYMBOLICATE_JS:
        return symbolicator.process_js(
            platform=platform,
            stacktraces=stacktraces,
            modules=modules,
            release=profile.get("release"),
            dist=profile.get("dist"),
            apply_source_context=False,
        )
    elif platform == "android":
        return symbolicator.process_jvm(
            platform=platform,
            exceptions=[],
            stacktraces=stacktraces,
            modules=modules,
            release_package=profile.get("transaction_metadata", {}).get("app.identifier"),
            apply_source_context=False,
            classes=[],
        )
    return symbolicator.process_payload(
        platform=platform,
        stacktraces=stacktraces,
        modules=modules,
        apply_source_context=False,
    )


class SymbolicationTimeout(Exception):
    pass


@metrics.wraps("process_profile.symbolicate.request")
def run_symbolicate(
    project: Project,
    profile: Profile,
    modules: list[Any],
    stacktraces: list[Any],
    platform: str,
) -> tuple[list[Any], list[Any], bool]:
    symbolication_start_time = time()

    def on_symbolicator_request() -> None:
        duration = time() - symbolication_start_time
        if duration > settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT:
            raise SymbolicationTimeout

    if platform in SHOULD_SYMBOLICATE_JS:
        symbolicator_platform = SymbolicatorPlatform.js
    else:
        symbolicator_platform = SymbolicatorPlatform.native
    symbolicator = Symbolicator(
        task_kind=SymbolicatorTaskKind(platform=symbolicator_platform),
        on_request=on_symbolicator_request,
        project=project,
        event_id=get_event_id(profile),
    )

    try:
        with sentry_sdk.start_span(op="task.profiling.symbolicate.process_payload"):
            response = symbolicate(
                symbolicator=symbolicator,
                profile=profile,
                stacktraces=stacktraces,
                modules=modules,
                platform=platform,
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
    except SymbolicationTimeout:
        metrics.incr("process_profile.symbolicate.timeout", sample_rate=1.0)

    # returns the unsymbolicated data to avoid errors later
    return modules, stacktraces, False


@metrics.wraps("process_profile.symbolicate.process")
def _process_symbolicator_results(
    profile: Profile,
    modules: list[Any],
    stacktraces: list[Any],
    frames_sent: set[int],
    platform: str,
) -> None:
    with sentry_sdk.start_span(op="task.profiling.symbolicate.process_results"):
        # update images with status after symbolication
        profile["debug_meta"]["images"] = modules

        if "version" in profile:
            _process_symbolicator_results_for_sample(
                profile,
                stacktraces,
                frames_sent,
                platform,
            )
            return

        if platform == "rust":
            _process_symbolicator_results_for_rust(profile, stacktraces)
        elif platform == "cocoa":
            _process_symbolicator_results_for_cocoa(profile, stacktraces)

        # rename the profile key to suggest it has been processed
        profile["profile"] = profile.pop("sampled_profile")


def _process_symbolicator_results_for_sample(
    profile: Profile, stacktraces: list[Any], frames_sent: set[int], platform: str
) -> None:
    if platform == "rust":

        def truncate_stack_needed(frames: list[dict[str, Any]], stack: list[Any]) -> list[Any]:
            # remove top frames related to the profiler (top of the stack)
            if frames[stack[0]].get("function", "") == "perf_signal_handler":
                stack = stack[2:]
            # remove unsymbolicated frames before the runtime calls (bottom of the stack)
            if frames[stack[len(stack) - 2]].get("function", "") == "":
                stack = stack[:-2]
            return stack

    elif platform == "cocoa":

        def truncate_stack_needed(
            frames: list[dict[str, Any]],
            stack: list[Any],
        ) -> list[Any]:
            # remove bottom frames we can't symbolicate
            if frames[stack[-1]].get("instruction_addr", "") == "0xffffffffc":
                return stack[:-2]
            return stack

    else:

        def truncate_stack_needed(
            frames: list[dict[str, Any]],
            stack: list[Any],
        ) -> list[Any]:
            return stack

    symbolicated_frames = stacktraces[0]["frames"]
    symbolicated_frames_dict = get_frame_index_map(symbolicated_frames)

    if len(frames_sent) > 0:
        raw_frames = profile["profile"]["frames"]
        new_frames = []
        symbolicated_frame_idx = 0

        for idx in range(len(raw_frames)):
            # If we didn't send the frame to symbolicator, add the raw frame.
            if idx not in frames_sent:
                new_frames.append(raw_frames[idx])
                continue

            # If we sent it to symbolicator, add the current symbolicated frame
            # to new_frames.
            # This works since symbolicated_frames are in the same order
            # as raw_frames (except some frames are not sent).
            for frame_idx in symbolicated_frames_dict[symbolicated_frame_idx]:
                f = symbolicated_frames[frame_idx]
                f["platform"] = platform
                new_frames.append(f)

            # go to the next symbolicated frame result
            symbolicated_frame_idx += 1

        new_frames_count = (
            len(raw_frames)
            + sum(len(frames) for frames in symbolicated_frames_dict.values())
            - len(symbolicated_frames_dict)
        )

        # in case we're dealing with a cocoa stack, we previously made a copy
        # of the leaf frame with adjust_instruction_addr = False.
        # If the original frame doesn't happen to shows up in the middle
        # of another stack, then it'll never be used.
        # Therefore we skip this sanity check for cocoa stacks
        if platform in SHOULD_SYMBOLICATE_JS:
            assert len(new_frames) == new_frames_count

        profile["profile"]["frames"] = new_frames
    elif symbolicated_frames:
        profile["profile"]["frames"] = symbolicated_frames

    if platform in SHOULD_SYMBOLICATE:

        def get_stack(stack: list[int]) -> list[int]:
            new_stack: list[int] = []
            for index in stack:
                if index in symbolicated_frames_dict:
                    # the new stack extends the older by replacing
                    # a specific frame index with the indices of
                    # the frames originated from the original frame
                    # should inlines be present
                    new_stack.extend(symbolicated_frames_dict[index])
                else:
                    new_stack.append(index)
            return new_stack

    else:

        def get_stack(stack: list[int]) -> list[int]:
            return stack

    stacks = []

    for stack in profile["profile"]["stacks"]:
        new_stack = get_stack(stack)

        if len(new_stack) >= 2:
            # truncate some unneeded frames in the stack (related to the profiler itself or impossible to symbolicate)
            new_stack = truncate_stack_needed(profile["profile"]["frames"], new_stack)

        stacks.append(new_stack)

    profile["profile"]["stacks"] = stacks


def _process_symbolicator_results_for_cocoa(profile: Profile, stacktraces: list[Any]) -> None:
    for original, symbolicated in zip(profile["sampled_profile"]["samples"], stacktraces):
        # remove bottom frames we can't symbolicate
        if (
            len(symbolicated["frames"]) > 1
            and symbolicated["frames"][-1].get("instruction_addr", "") == "0xffffffffc"
        ):
            original["frames"] = symbolicated["frames"][:-2]
        else:
            original["frames"] = symbolicated["frames"]


def _process_symbolicator_results_for_rust(profile: Profile, stacktraces: list[Any]) -> None:
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


def get_frame_index_map(frames: list[dict[str, Any]]) -> dict[int, list[int]]:
    index_map: dict[int, list[int]] = {}
    for i, frame in enumerate(frames):
        # In case we don't have an `original_index` field, we default to using
        # the index of the frame in order to still produce a data structure
        # with the right shape.
        index_map.setdefault(frame.get("original_index", i), []).append(i)
    return index_map


@metrics.wraps("process_profile.deobfuscate_using_symbolicator")
def _deobfuscate_using_symbolicator(project: Project, profile: Profile, debug_file_id: str) -> bool:
    symbolication_start_time = time()

    def on_symbolicator_request() -> None:
        duration = time() - symbolication_start_time
        if duration > settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT:
            raise SymbolicationTimeout

    symbolicator = Symbolicator(
        task_kind=SymbolicatorTaskKind(platform=SymbolicatorPlatform.jvm),
        on_request=on_symbolicator_request,
        project=project,
        event_id=get_event_id(profile),
    )

    try:
        with sentry_sdk.start_span(op="task.profiling.deobfuscate.process_payload"):
            response = symbolicate(
                symbolicator=symbolicator,
                profile=profile,
                modules=[
                    {
                        "uuid": debug_file_id,
                        "type": "proguard",
                    }
                ],
                stacktraces=[
                    {
                        "frames": convert_android_methods_to_jvm_frames(
                            profile["profile"]["methods"]
                        )
                    },
                ],
                platform=profile["platform"],
            )
            if response:
                deobfuscation_context = {}
                if response["status"] == "failed":
                    deobfuscation_context["status"] = response["status"]
                    deobfuscation_context["message"] = response["message"]
                if "errors" in response:
                    deobfuscation_context["errors"] = response["errors"]
                sentry_sdk.set_context("profile deobfuscation", deobfuscation_context)
                if "stacktraces" in response:
                    merge_jvm_frames_with_android_methods(
                        frames=response["stacktraces"][0]["frames"],
                        methods=profile["profile"]["methods"],
                    )
                    return True
            else:
                sentry_sdk.capture_message("No response from Symbolicator")
    except SymbolicationTimeout:
        metrics.incr("process_profile.symbolicate.timeout", sample_rate=1.0)
    sentry_sdk.capture_message("Deobfuscation via Symbolicator failed")
    return False


def get_debug_file_id(profile: Profile) -> str | None:
    debug_file_id = profile.get("build_id")

    if debug_file_id is None or debug_file_id == "":
        return None

    try:
        return UUID(debug_file_id).hex
    except ValueError:
        return None


@metrics.wraps("process_profile.deobfuscate")
def _deobfuscate(profile: Profile, project: Project) -> None:
    debug_file_id = get_debug_file_id(profile)
    if debug_file_id is None:
        # we still need to decode signatures
        for m in profile["profile"]["methods"]:
            if m.get("signature"):
                types = deobfuscate_signature(m["signature"])
                m["signature"] = format_signature(types)
        return

    try:
        with sentry_sdk.start_span(op="deobfuscate_with_symbolicator"):
            success = _deobfuscate_using_symbolicator(
                project=project,
                profile=profile,
                debug_file_id=debug_file_id,
            )
            sentry_sdk.set_tag("deobfuscated_with_symbolicator_with_success", success)
            if success:
                return
    except Exception as e:
        sentry_sdk.capture_exception(e)


def get_event_id(profile: Profile) -> str:
    if "chunk_id" in profile:
        return profile["chunk_id"]
    elif "profile_id" in profile:
        return profile["profile_id"]
    return profile["event_id"]


def get_data_category(profile: Profile) -> DataCategory:
    if profile.get("version") == "2":
        return (
            DataCategory.PROFILE_CHUNK_UI
            if profile["platform"] in UI_PROFILE_PLATFORMS
            else DataCategory.PROFILE_CHUNK
        )
    return DataCategory.PROFILE_INDEXED


@metrics.wraps("process_profile.track_outcome")
def _track_outcome(
    profile: Profile,
    project: Project,
    outcome: Outcome,
    categories: list[DataCategory],
    reason: str | None = None,
    quantity: int = 1,
) -> None:
    for category in categories:
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=outcome,
            reason=reason,
            timestamp=datetime.now(timezone.utc),
            event_id=get_event_id(profile),
            category=category,
            quantity=quantity,
        )


def _track_failed_outcome(profile: Profile, project: Project, reason: str) -> None:
    categories = []
    if "profiler_id" not in profile:
        categories.append(DataCategory.PROFILE)
        if profile.get("sampled"):
            categories.append(DataCategory.PROFILE_INDEXED)
    else:
        categories.append(DataCategory.PROFILE_CHUNK)
    _track_outcome(
        profile=profile,
        project=project,
        outcome=Outcome.INVALID,
        categories=categories,
        reason=reason,
    )


@metrics.wraps("process_profile.insert_vroom_profile")
def _insert_vroom_profile(profile: Profile) -> bool:
    with sentry_sdk.start_span(op="task.profiling.insert_vroom"):
        try:
            path = "/chunk" if "profiler_id" in profile else "/profile"
            response = get_from_profiling_service(
                method="POST",
                path=path,
                json_data=profile,
                metric=(
                    "profiling.profile.payload.size",
                    {
                        "type": "chunk" if "profiler_id" in profile else "profile",
                        "platform": profile["platform"],
                    },
                ),
            )

            sentry_sdk.set_tag("vroom.response.status_code", str(response.status))

            reason = "bad status"

            if response.status == 204:
                return True
            elif response.status == 429:
                reason = "gcs timeout"
            elif response.status == 412:
                reason = "duplicate profile"

            metrics.incr(
                "process_profile.insert_vroom_profile.error",
                tags={
                    "platform": profile["platform"],
                    "reason": reason,
                    "status_code": response.status,
                },
                sample_rate=1.0,
            )
            return False
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
    _track_failed_outcome(profile, project, "profiling_failed_vroom_insertion")
    return False


def prepare_android_js_profile(profile: Profile) -> None:
    profile["js_profile"] = {"profile": profile["js_profile"]}
    p = profile["js_profile"]
    p["platform"] = "javascript"
    p["debug_meta"] = profile["debug_meta"]
    p["version"] = "1"
    p["event_id"] = get_event_id(profile)
    p["release"] = profile["release"]
    p["dist"] = profile["dist"]


def clean_android_js_profile(profile: Profile) -> None:
    p = profile["js_profile"]
    del p["platform"]
    del p["debug_meta"]
    del p["version"]
    del p["event_id"]
    del p["release"]
    del p["dist"]


class _ProjectKeyKwargs(TypedDict):
    project_id: int
    use_case: str


@metrics.wraps("process_profile.track_outcome")
def _track_duration_outcome(
    profile: Profile,
    project: Project,
) -> None:
    duration_ms = _calculate_profile_duration_ms(profile)
    if duration_ms <= 0:
        return
    track_outcome(
        org_id=project.organization_id,
        project_id=project.id,
        key_id=None,
        outcome=Outcome.ACCEPTED,
        timestamp=datetime.now(timezone.utc),
        category=(
            DataCategory.PROFILE_DURATION_UI
            if profile["platform"] in UI_PROFILE_PLATFORMS
            else DataCategory.PROFILE_DURATION
        ),
        quantity=duration_ms,
    )


def _calculate_profile_duration_ms(profile: Profile) -> int:
    version = profile.get("version")
    if version:
        if version == "1":
            return _calculate_duration_for_sample_format_v1(profile)
        elif version == "2":
            return _calculate_duration_for_sample_format_v2(profile)
    else:
        platform = profile["platform"]
        if platform == "android":
            return _calculate_duration_for_android_format(profile)
    return 0


def _calculate_duration_for_sample_format_v1(profile: Profile) -> int:
    start_ns = int(profile["transaction"].get("relative_start_ns", 0))
    end_ns = int(profile["transaction"].get("relative_end_ns", 0))
    duration_ns = end_ns - start_ns
    # try another method to determine the duration in case it's negative or 0.
    if duration_ns <= 0:
        samples = sorted(
            profile["profile"]["samples"],
            key=itemgetter("elapsed_since_start_ns"),
        )
        if len(samples) < 2:
            return 0
        first, last = samples[0], samples[-1]
        first_ns = int(first["elapsed_since_start_ns"])
        last_ns = int(last["elapsed_since_start_ns"])
        duration_ns = last_ns - first_ns
    duration_ms = int(duration_ns * 1e-6)
    return min(duration_ms, 30000)


def _calculate_duration_for_sample_format_v2(profile: Profile) -> int:
    timestamp_getter = itemgetter("timestamp")
    samples = profile["profile"]["samples"]
    min_timestamp = min(samples, key=timestamp_getter)
    max_timestamp = max(samples, key=timestamp_getter)
    duration_secs = max_timestamp["timestamp"] - min_timestamp["timestamp"]
    duration_ms = int(duration_secs * 1e3)
    if duration_ms > MAX_DURATION_SAMPLE_V2:
        sentry_sdk.set_context(
            "profile duration calculation",
            {
                "min_timestamp": min_timestamp,
                "max_timestamp": max_timestamp,
                "duration_ms": duration_ms,
            },
        )
        sentry_sdk.capture_message("Calculated duration is above the limit")
        return MAX_DURATION_SAMPLE_V2
    return duration_ms


def _calculate_duration_for_android_format(profile: Profile) -> int:
    return int(profile["duration_ns"] * 1e-6)


def _set_frames_platform(profile: Profile) -> None:
    platform = profile["platform"]
    frames = (
        profile["profile"]["methods"] if platform == "android" else profile["profile"]["frames"]
    )
    for f in frames:
        if "platform" not in f:
            f["platform"] = platform


class UnknownProfileTypeException(Exception):
    pass


class UnknownClientSDKException(Exception):
    pass


def determine_profile_type(profile: Profile) -> EventType:
    if "version" in profile:
        version = profile["version"]
        if version == "1":
            return EventType.PROFILE
        elif version == "2":
            return EventType.PROFILE_CHUNK
    elif profile["platform"] == "android":
        if "profiler_id" in profile:
            return EventType.PROFILE_CHUNK
        else:
            # This is the legacy android format
            return EventType.PROFILE
    raise UnknownProfileTypeException


def determine_client_sdk(profile: Profile, event_type: EventType) -> tuple[str, str]:
    client_sdk = profile.get("client_sdk")

    if client_sdk:
        sdk_name = client_sdk.get("name")
        sdk_version = client_sdk.get("version")

        if sdk_name and sdk_version:
            return sdk_name, sdk_version

    # some older sdks were sending the profile chunk without the
    # sdk info, here we hard code a few and assign them a guaranteed
    # outdated version
    if event_type == EventType.PROFILE_CHUNK:
        if profile["platform"] == "python":
            return "sentry.python", "0.0.0"
        elif profile["platform"] == "cocoa":
            return "sentry.cocoa", "0.0.0"
        elif profile["platform"] == "node":
            # there are other node platforms but it's not straight forward
            # to figure out which it is here so collapse them all into just node
            return "sentry.javascript.node", "0.0.0"

        # Other platforms do not have a version released where it sends
        # a profile chunk without the client sdk info

    raise UnknownClientSDKException


def is_sdk_deprecated(event_type: EventType, sdk_name: str, sdk_version: str) -> bool:
    minimum_version = get_minimum_sdk_version(event_type.value, sdk_name, hard_limit=True)

    # no minimum sdk version was specified
    if minimum_version is None:
        return False

    try:
        version = parse_version(sdk_version)
    except InvalidVersion:
        return False

    # satisfies the minimum sdk version
    if version >= minimum_version:
        return False

    parts = sdk_name.split(".", 2)
    if len(parts) >= 2:
        normalized_sdk_name = ".".join(parts[:2])
        metrics.incr(
            "process_profile.sdk.deprecated",
            tags={"sdk_name": normalized_sdk_name},
            sample_rate=1.0,
        )

    return True


@metrics.wraps("process_profile.process_vroomrs_profile")
def _process_vroomrs_profile(profile: Profile, project: Project) -> bool:
    if "profiler_id" in profile and _process_vroomrs_chunk_profile(profile=profile):
        return True
    _track_failed_outcome(profile, project, "profiling_failed_vroomrs_processing")
    return False


def _process_vroomrs_chunk_profile(profile: Profile) -> bool:
    with sentry_sdk.start_span(op="task.profiling.process_vroomrs_chunk_profile"):
        try:
            # todo (improvement): check the feasibility of passing the profile
            # dict directly to the PyO3 module to avoid json serialization/deserialization
            with sentry_sdk.start_span(op="json.dumps"):
                json_profile = json.dumps(profile)
            with sentry_sdk.start_span(op="json.unmarshal"):
                chunk = vroomrs.profile_chunk_from_json_str(json_profile, profile["platform"])
            chunk.normalize()
            with sentry_sdk.start_span(op="gcs.write", name="compress and write"):
                storage = get_profiles_storage()
                compressed_chunk = chunk.compress()
                storage.save(chunk.storage_path(), io.BytesIO(compressed_chunk))
            with sentry_sdk.start_span(op="processing", name="send chunk to kafka"):
                payload = build_chunk_kafka_message(chunk)
                topic = ArroyoTopic(get_topic_definition(Topic.PROFILE_CHUNKS)["real_topic_name"])
                profile_chunks_producer.produce(topic, payload)
            with sentry_sdk.start_span(op="processing", name="extract functions metrics"):
                functions = chunk.extract_functions_metrics(
                    min_depth=1, filter_system_frames=True, max_unique_functions=100
                )
                if functions is not None and len(functions) > 0:
                    payload = build_chunk_functions_kafka_message(chunk, functions)
                    topic = ArroyoTopic(
                        get_topic_definition(Topic.PROFILES_CALL_TREE)["real_topic_name"]
                    )
                    profile_functions_producer.produce(topic, payload)
            return True
        except Exception as e:
            sentry_sdk.capture_exception(e)
            metrics.incr(
                "process_profile.process_vroomrs_profile.error",
                tags={"platform": profile["platform"], "reason": "encountered error"},
                sample_rate=1.0,
            )
            return False


def build_chunk_kafka_message(chunk: vroomrs.ProfileChunk) -> KafkaPayload:
    data = {
        "chunk_id": chunk.get_chunk_id(),
        "duration_ms": chunk.duration_ms(),
        "end_timestamp": chunk.end_timestamp(),
        "environment": chunk.get_environment(),
        "platform": chunk.get_platform(),
        "profiler_id": chunk.get_profiler_id(),
        "project_id": chunk.get_project_id(),
        "received": int(chunk.get_received()),
        "release": chunk.get_release(),
        "retention_days": chunk.get_retention_days(),
        "sdk_name": chunk.sdk_name(),
        "sdk_version": chunk.sdk_version(),
        "start_timestamp": chunk.start_timestamp(),
    }
    return KafkaPayload(None, json.dumps(data).encode("utf-8"), [])


def build_chunk_functions_kafka_message(
    chunk: vroomrs.ProfileChunk, functions: list[vroomrs.CallTreeFunction]
) -> KafkaPayload:
    data = {
        "environment": chunk.get_environment() or "",
        "functions": [
            {
                "fingerprint": f.get_fingerprint(),
                "function": f.get_function(),
                "package": f.get_package(),
                "in_app": f.get_in_app(),
                "self_times_ns": f.get_self_times_ns(),
                "thread_id": f.get_thread_id(),
            }
            for f in functions
        ],
        "profile_id": chunk.get_profiler_id(),
        "platform": chunk.get_platform(),
        "project_id": chunk.get_project_id(),
        "received": int(chunk.get_received()),
        "release": chunk.get_release() or "",
        "retention_days": chunk.get_retention_days(),
        "timestamp": int(chunk.start_timestamp()),
        "start_timestamp": chunk.start_timestamp(),
        "end_timestamp": chunk.end_timestamp(),
        "transaction_name": "",
        "profiling_type": "continuous",
        "materialization_version": 1,
    }
    return KafkaPayload(None, json.dumps(data).encode("utf-8"), [])
