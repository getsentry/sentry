from typing import Any, MutableMapping

from django.conf import settings

from sentry.lang.native.symbolicator import Symbolicator
from sentry.models import Project
from sentry.profiles.device import classify_device
from sentry.tasks.base import instrumented_task
from sentry.utils import json, kafka_config
from sentry.utils.pubsub import KafkaPublisher

processed_profiles_publisher = None


@instrumented_task(  # type: ignore
    name="profiles.process",
    queue="profiles.process",
    default_retry_delay=5,
    max_retries=5,
    acks_late=True,
)
def process_profile(profile: MutableMapping[str, Any], **kwargs: Any) -> None:
    if profile["platform"] == "cocoa":
        if not _validate_ios_profile(profile=profile):
            return None
        profile = _symbolicate(profile=profile)

    profile = _normalize(profile=profile)

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


def _normalize(profile: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    normalized_profile = {
        "device_locale": profile["device_locale"],
        "device_manufacturer": profile["device_manufacturer"],
        "device_model": profile["device_model"],
        "device_os_name": profile["device_os_name"],
        "device_os_version": profile["device_os_version"],
        "duration_ns": int(profile["duration_ns"]),
        "environment": profile.get("environment"),
        "organization_id": profile["organization_id"],
        "platform": profile["platform"],
        "profile": json.dumps(profile["profile"]),
        "profile_id": profile["profile_id"],
        "project_id": profile["project_id"],
        "received": profile["received"],
        "retention_days": 30,
        "trace_id": profile["trace_id"],
        "transaction_id": profile["transaction_id"],
        "transaction_name": profile["transaction_name"],
        "version_code": profile["version_code"],
        "version_name": profile["version_name"],
    }

    classification_options = {
        "model": profile["device_model"],
        "os_name": profile["device_os_name"],
        "is_emulator": profile["device_is_emulator"],
    }

    if profile["platform"] == "android":
        normalized_profile.update(
            {
                "android_api_level": profile["android_api_level"],
            }
        )
        classification_options.update(
            {
                "cpu_frequencies": profile["device_cpu_frequencies"],
                "physical_memory_bytes": int(profile["device_physical_memory_bytes"]),
            }
        )
    elif profile["platform"] == "cocoa":
        normalized_profile.update(
            {
                "device_os_build_number": profile["device_os_build_number"],
            }
        )

    normalized_profile["device_classification"] = str(classify_device(**classification_options))

    return normalized_profile


def _validate_ios_profile(profile: MutableMapping[str, Any]) -> bool:
    return "samples" in profile.get("sampled_profile", {})


def _symbolicate(profile: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    project = Project.objects.get_from_cache(id=profile["project_id"])
    symbolicator = Symbolicator(project=project, event_id=profile["profile_id"])

    for i in profile["debug_meta"]["images"]:
        i["debug_id"] = i["uuid"]

    for s in profile["sampled_profile"]["samples"]:
        for f in s["frames"]:
            # https://github.com/dotnet/runtime/pull/40435/files/af4db134ddd9deea10e75d3f732cc35d3b61119e#r479544995
            f["instruction_addr"] = hex(int(f["instruction_addr"], 16) & 0x7FFFFFFFFFFF)

    modules = profile["debug_meta"]["images"]
    stacktraces = [
        {
            "registers": {},
            "frames": s["frames"],
        }
        for s in profile["sampled_profile"]["samples"]
    ]

    response = symbolicator.process_payload(stacktraces=stacktraces, modules=modules)
    for original, symbolicated in zip(
        profile["sampled_profile"]["samples"], response["stacktraces"]
    ):
        for original_frame, symbolicated_frame in zip(original["frames"], symbolicated["frames"]):
            original_frame.update(symbolicated_frame)

    # save the symbolicated frames on the profile
    profile["profile"] = profile["sampled_profile"]

    return profile
