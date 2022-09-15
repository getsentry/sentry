from __future__ import annotations

from typing import Any, MutableMapping

from django.conf import settings

from sentry.utils import kafka_config


def get_config(
    topic: str, group_id: str, auto_offset_reset: str, force_cluster: str | None
) -> MutableMapping[Any, Any]:
    cluster_name: str = force_cluster or settings.KAFKA_TOPICS[topic]["cluster"]
    consumer_config: MutableMapping[Any, Any] = kafka_config.get_kafka_consumer_cluster_options(
        cluster_name,
        override_params={
            "auto.offset.reset": auto_offset_reset,
            "enable.auto.commit": False,
            "enable.auto.offset.store": False,
            "group.id": group_id,
        },
    )
    return consumer_config
