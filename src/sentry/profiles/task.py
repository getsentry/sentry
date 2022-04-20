from typing import Any, MutableMapping

from django.conf import settings
from symbolic import ProguardMapper  # type: ignore

from sentry.lang.native.symbolicator import Symbolicator
from sentry.models import Project, ProjectDebugFile
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
    elif profile["platform"] == "android":
        profile = _deobfuscate(profile=profile)

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
            # https://github.com/microsoft/plcrashreporter/blob/748087386cfc517936315c107f722b146b0ad1ab/Source/PLCrashAsyncThread_arm.c#L84
            f["instruction_addr"] = hex(int(f["instruction_addr"], 16) & 0x0000000FFFFFFFFF)

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


def _deobfuscate(profile: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    debug_file_id = profile.get("build_id")
    if debug_file_id == "" or debug_file_id is None:
        return profile

    project = Project.objects.get_from_cache(id=profile["project_id"])
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
