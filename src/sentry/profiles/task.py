from datetime import datetime
from time import sleep, time
from typing import Any, MutableMapping, Optional

import sentry_sdk
from django.conf import settings
from pytz import UTC
from symbolic import ProguardMapper  # type: ignore

from sentry import quotas
from sentry.constants import DataCategory
from sentry.lang.native.symbolicator import Symbolicator
from sentry.models import Organization, Project, ProjectDebugFile
from sentry.profiles.device import classify_device
from sentry.tasks.base import instrumented_task
from sentry.tasks.symbolication import RetrySymbolication
from sentry.utils import json, kafka_config
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.pubsub import KafkaPublisher

processed_profiles_publisher = None


@instrumented_task(  # type: ignore
    name="profiles.process",
    queue="profiles.process",
    default_retry_delay=5,
    max_retries=5,
    acks_late=True,
)
def process_profile(
    profile: MutableMapping[str, Any],
    key_id: Optional[int],
    **kwargs: Any,
) -> None:
    project = Project.objects.get_from_cache(id=profile["project_id"])

    if profile["platform"] == "cocoa":
        profile = _symbolicate(profile=profile, project=project)
    elif profile["platform"] == "android":
        profile = _deobfuscate(profile=profile, project=project)
    elif profile["platform"] == "rust":
        profile = _symbolicate(profile=profile, project=project)

    organization = Organization.objects.get_from_cache(id=project.organization_id)
    profile = _normalize(profile=profile, organization=organization)

    global processed_profiles_publisher

    if processed_profiles_publisher is None:
        config = settings.KAFKA_TOPICS[settings.KAFKA_PROFILES]
        processed_profiles_publisher = KafkaPublisher(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"]),
        )

    processed_profiles_publisher.publish(
        "processed-profiles",
        json.dumps(profile),
    )

    track_outcome(
        org_id=project.organization_id,
        project_id=project.id,
        key_id=key_id,
        outcome=Outcome.ACCEPTED,
        reason=None,
        timestamp=datetime.utcnow().replace(tzinfo=UTC),
        event_id=profile["transaction_id"],
        category=DataCategory.PROFILE,
        quantity=1,
    )


def _normalize(
    profile: MutableMapping[str, Any],
    organization: Organization,
) -> MutableMapping[str, Any]:
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

    return profile


def _symbolicate(profile: MutableMapping[str, Any], project: Project) -> MutableMapping[str, Any]:
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

                original["original_frames"] = original["frames"]
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

    return profile


def _deobfuscate(profile: MutableMapping[str, Any], project: Project) -> MutableMapping[str, Any]:
    debug_file_id = profile.get("build_id")
    if debug_file_id is None or debug_file_id == "":
        return profile

    dif_paths = ProjectDebugFile.difcache.fetch_difs(project, [debug_file_id], features=["mapping"])
    debug_file_path = dif_paths.get(debug_file_id)
    if debug_file_path is None:
        return profile

    mapper = ProguardMapper.open(debug_file_path)
    if not mapper.has_line_info:
        return profile

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

    return profile
