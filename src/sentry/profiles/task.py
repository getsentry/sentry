from __future__ import annotations

from datetime import datetime
from time import sleep, time
from typing import Any, List, Mapping, MutableMapping, Optional

import sentry_sdk
from django.conf import settings
from django.utils import timezone
from pytz import UTC
from symbolic import ProguardMapper  # type: ignore

from sentry import quotas
from sentry.constants import DataCategory
from sentry.lang.native.symbolicator import Symbolicator
from sentry.models import Organization, Project, ProjectDebugFile
from sentry.profiles.device import classify_device
from sentry.signals import first_profile_received
from sentry.tasks.base import instrumented_task
from sentry.tasks.symbolication import RetrySymbolication
from sentry.utils import json, kafka_config, metrics
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.profiling import get_from_profiling_service
from sentry.utils.pubsub import KafkaPublisher

Profile = MutableMapping[str, Any]
CallTrees = Mapping[str, List[Any]]

processed_profiles_publisher = None


@instrumented_task(  # type: ignore
    name="profiles.process",
    queue="profiles.process",
    default_retry_delay=5,
    max_retries=5,
    acks_late=True,
)
def process_profile(
    profile: Profile,
    key_id: Optional[int],
    **kwargs: Any,
) -> None:
    project = Project.objects.get_from_cache(id=profile["project_id"])

    try:
        if _should_symbolicate(profile):
            _symbolicate(profile=profile, project=project)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        _track_outcome(
            profile=profile,
            project=project,
            outcome=Outcome.INVALID,
            key_id=key_id,
            reason="failed-symbolication",
        )
        return

    try:
        if _should_deobfuscate(profile):
            _deobfuscate(profile=profile, project=project)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        _track_outcome(
            profile=profile,
            project=project,
            outcome=Outcome.INVALID,
            key_id=key_id,
            reason="failed-deobfuscation",
        )
        return

    organization = Organization.objects.get_from_cache(id=project.organization_id)

    _normalize(profile=profile, organization=organization)

    if not _insert_vroom_profile(profile=profile):
        _track_outcome(
            profile=profile,
            project=project,
            outcome=Outcome.INVALID,
            key_id=key_id,
            reason="failed-vroom-insertion",
        )
        return

    _initialize_publisher()
    _insert_eventstream_call_tree(profile=profile)
    _insert_eventstream_profile(profile=profile)

    _track_outcome(profile=profile, project=project, outcome=Outcome.ACCEPTED, key_id=key_id)


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
    if profile["platform"] in {"cocoa", "android"}:
        classification_options = dict()

        if profile["platform"] == "android":
            classification_options.update(
                {
                    "cpu_frequencies": profile["device_cpu_frequencies"],
                    "physical_memory_bytes": profile["device_physical_memory_bytes"],
                }
            )

        classification_options.update(
            {
                "model": profile["device_model"],
                "os_name": profile["device_os_name"],
                "is_emulator": profile["device_is_emulator"],
            }
        )

        profile.update({"device_classification": str(classify_device(**classification_options))})
    else:
        profile.update(
            {
                attr: ""
                for attr in (
                    "device_classification",
                    "device_locale",
                    "device_manufacturer",
                    "device_model",
                )
                if attr not in profile
            }
        )

    profile.update(
        {
            "profile": json.dumps(profile["profile"]),
            "retention_days": quotas.get_event_retention(organization=organization),
        }
    )


@metrics.wraps("process_profile.symbolicate")
def _symbolicate(profile: Profile, project: Project) -> None:
    symbolicator = Symbolicator(project=project, event_id=profile["profile_id"])
    modules = profile["debug_meta"]["images"]
    stacktraces = [
        {
            "registers": {},
            "frames": s["frames"],
        }
        for s in profile["sampled_profile"]["samples"]
    ]

    symbolication_start_time = time()

    while True:
        try:
            response = symbolicator.process_payload(stacktraces=stacktraces, modules=modules)

            assert len(profile["sampled_profile"]["samples"]) == len(response["stacktraces"])

            for original, symbolicated in zip(
                profile["sampled_profile"]["samples"], response["stacktraces"]
            ):
                for frame in symbolicated["frames"]:
                    frame.pop("pre_context", None)
                    frame.pop("context_line", None)
                    frame.pop("post_context", None)

                # here we exclude the frames related to the profiler itself as we don't care to profile the profiler.
                if (
                    profile["platform"] == "rust"
                    and len(symbolicated["frames"]) >= 2
                    and symbolicated["frames"][0].get("function", "") == "perf_signal_handler"
                ):
                    original["frames"] = symbolicated["frames"][2:]
                else:
                    original["frames"] = symbolicated["frames"]
            break
        except RetrySymbolication as e:
            if (
                time() - symbolication_start_time
            ) > settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT:
                break
            else:
                sleep_time = (
                    settings.SYMBOLICATOR_MAX_RETRY_AFTER
                    if e.retry_after is None
                    else min(e.retry_after, settings.SYMBOLICATOR_MAX_RETRY_AFTER)
                )
                sleep(sleep_time)
                continue
        except Exception as e:
            sentry_sdk.capture_exception(e)
            break

    # remove debug information we don't need anymore
    profile.pop("debug_meta")

    # rename the profile key to suggest it has been processed
    profile["profile"] = profile.pop("sampled_profile")


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
    key_id: Optional[int],
    reason: Optional[str] = None,
) -> None:
    if not project.flags.has_profiles:
        first_profile_received.send_robust(project=project, sender=Project)

    track_outcome(
        org_id=project.organization_id,
        project_id=project.id,
        key_id=key_id,
        outcome=outcome,
        reason=reason,
        timestamp=datetime.utcnow().replace(tzinfo=UTC),
        event_id=profile["transaction_id"],
        category=DataCategory.PROFILE,
        quantity=1,
    )


@metrics.wraps("process_profile.initialize_publisher")
def _initialize_publisher() -> None:
    global processed_profiles_publisher

    if processed_profiles_publisher is None:
        config = settings.KAFKA_TOPICS[settings.KAFKA_PROFILES]
        processed_profiles_publisher = KafkaPublisher(
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
    if processed_profiles_publisher is None:
        return

    processed_profiles_publisher.publish(
        "processed-profiles",
        json.dumps(profile),
    )


@metrics.wraps("process_profile.insert_eventstream.call_tree")
def _insert_eventstream_call_tree(profile: Profile) -> None:
    # just a guard as this should always be initialized already
    if processed_profiles_publisher is None:
        return

    try:
        event = _get_event_instance(profile)
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

    processed_profiles_publisher.publish(
        "profiles-call-tree",
        json.dumps(event),
    )


@metrics.wraps("process_profile.get_event_instance")
def _get_event_instance(profile: Profile) -> Any:
    return {
        "profile_id": profile["profile_id"],
        "project_id": profile["project_id"],
        "transaction_name": profile["transaction_name"],
        "timestamp": profile["received"],
        "platform": profile["platform"],
        "environment": profile.get("environment"),
        "release": f"{profile['version_name']} ({profile['version_code']})",
        "os_name": profile["device_os_name"],
        "os_version": profile["device_os_version"],
        "retention_days": profile["retention_days"],
        "call_trees": profile["call_trees"],
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
            profile["call_trees"] = json.loads(response.data)["call_trees"]
        else:
            metrics.incr(
                "profiling.insert_vroom_profile.error",
                tags={"platform": profile["platform"], "reason": "bad status"},
            )
            return False
        return True
    except Exception as e:
        sentry_sdk.capture_exception(e)
        metrics.incr(
            "profiling.insert_vroom_profile.error",
            tags={"platform": profile["platform"], "reason": "encountered error"},
        )
        return False
    finally:
        profile["received"] = original_timestamp
        profile["profile"] = ""
