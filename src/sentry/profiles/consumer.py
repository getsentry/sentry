from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, MutableMapping, Optional, Sequence

import msgpack
from confluent_kafka import Message, Producer
from django.conf import settings

from sentry.lang.native.processing import process_payload
from sentry.profiles.device import classify_device
from sentry.utils import json, kafka_config
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker, BatchingKafkaConsumer
from sentry.utils.kafka import create_batching_kafka_consumer


def get_profiles_consumer(
    topic: Optional[str] = None, **options: Dict[str, str]
) -> BatchingKafkaConsumer:
    config = settings.KAFKA_TOPICS[settings.KAFKA_PROFILES]
    producer = Producer(
        kafka_config.get_kafka_producer_cluster_options(config["cluster"]),
    )
    options = {
        "max_batch_size": 10,
        "max_batch_time": 1,
        "group_id": "profiles",
        "auto_offset_reset": "latest",
    }
    return create_batching_kafka_consumer(
        {settings.KAFKA_PROFILES},
        worker=ProfilesWorker(producer=producer),
        **options,
    )


def _normalize(profile: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    normalized_profile = {
        "organization_id": profile["organization_id"],
        "project_id": profile["project_id"],
        "transaction_id": profile["transaction_id"],
        "received": datetime.utcfromtimestamp(profile["received"]).isoformat(),
        "device_locale": profile["device_locale"],
        "device_manufacturer": profile["device_manufacturer"],
        "device_model": profile["device_model"],
        "device_os_name": profile["device_os_name"],
        "device_os_version": profile["device_os_version"],
        "duration_ns": int(profile["duration_ns"]),
        "environment": profile.get("environment"),
        "platform": profile["platform"],
        "trace_id": profile["trace_id"],
        "transaction_name": profile["transaction_name"],
        "version_name": profile["version_name"],
        "version_code": profile["version_code"],
        "retention_days": 30,
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
                "profile": profile["stacktrace"],
                "symbols": json.dumps(profile["android_trace"]),
            }
        )
        classification_options.update(
            {
                "cpu_frequencies": profile["device_cpu_frequencies"],
                "physical_memory_bytes": profile["device_physical_memory_bytes"],
            }
        )
    elif profile["platform"] == "ios":
        normalized_profile.update(
            {
                "device_os_build_number": profile["device_os_build_number"],
                "profile": profile["sampled_profile"],
                "symbols": profile["debug_meta"],
            }
        )

    normalized_profile["device_classification"] = str(classify_device(**classification_options))

    return normalized_profile


def _validate_ios_profile(profile: MutableMapping[str, Any]) -> bool:
    return "samples" in profile.get("sampled_profile", {})


class ProfilesWorker(AbstractBatchWorker):  # type: ignore
    def __init__(self, producer: Producer) -> None:
        self.__producer = producer
        self.__producer_topic = "processed-profiles"

    def process_message(self, message: Message) -> MutableMapping[str, Any]:
        message = msgpack.unpackb(message.value(), use_list=False)
        profile = json.loads(message["payload"])

        profile.update(
            {
                "organization_id": message["organization_id"],
                "project_id": message["project_id"],
                "received": message["received"],
            }
        )

        if profile["platform"] == "ios":
            if not _validate_ios_profile(profile):
                return None
            profile = self.symbolicate(profile)

        try:
            return _normalize(profile)
        except KeyError:
            return None

    def symbolicate(self, profile: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        samples = profile["sampled_profiles"]["samples"]

        # collect all unsymbolicated frames
        frames_by_address = {}
        indexes_by_address = defaultdict(list)
        for i, s in enumerate(samples):
            for j, f in enumerate(s["frames"]):
                indexes_by_address[f["instruction_addr"]].append((i, j))
                frames_by_address[f["instruction_addr"]] = f

        # set proper keys for process_payload to do its job
        profile["stacktraces"] = {"frames": frames_by_address.values()}
        profile["event_id"] = profile["transaction_id"]
        profile["project"] = profile["project_id"]

        # symbolicate
        profile = process_payload(profile)

        # replace  unsymbolicated frames by symbolicated ones
        frames_by_address = {f["instruction_addr"]: f for f in profile["stacktraces"]["frames"]}
        for address, indexes in indexes_by_address.items():
            for i, j in indexes:
                samples[i][j] = frames_by_address[address]

        # remove unneeded keys
        for k in ("event_id", "project", "stacktraces", "debug_meta"):
            profile.pop(k, None)

        return profile

    def flush_batch(self, profiles: Sequence[MutableMapping[str, Any]]) -> None:
        self.__producer.poll(0)
        for profile in profiles:
            self.__producer.produce(
                topic=self.__producer_topic, value=json.dumps(profile), callback=self.callback
            )
        self.__producer.flush()

    def shutdown(self) -> None:
        self.__producer.close()

    def callback(self, error: Any, message: Any) -> None:
        if error is not None:
            raise Exception(str(error))
