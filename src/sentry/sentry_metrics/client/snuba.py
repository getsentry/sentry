from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, Optional, Sequence, Union

import sentry_kafka_schemas
import urllib3
from django.core.cache import cache

from sentry import quotas
from sentry.sentry_metrics.client.base import GenericMetricsBackend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import json, snuba

ingest_codec: sentry_kafka_schemas.codecs.Codec[Any] = sentry_kafka_schemas.get_codec(
    "ingest-metrics"
)

_METRIC_TYPE_TO_ENTITY: Mapping[str, str] = {
    "c": "generic_metrics_counters",
    "s": "generic_metrics_sets",
    "d": "generic_metrics_distributions",
}


def get_retention_from_org_id(org_id: int) -> int:
    cache_key = f"sentry_metrics:org_retention_days:{org_id}"
    cached_retention: Optional[int] = cache.get(cache_key)

    if cached_retention is not None:
        return cached_retention
    else:
        # the default in Snuba is 90 days, and if there is no
        # org-configured retention stored, we use that default
        retention = quotas.backend.get_event_retention(organization=org_id) or 90
        cache.set(cache_key, retention)

        return retention


# TODO: Use the Futures that are returned by the call to produce.
# These can be returned to the user, or handled in some way internally.
# Ensure all of the MetricsBackend implementations have the same
# Future return type.


class SnubaMetricsBackend(GenericMetricsBackend):
    def __init__(self) -> None:
        self.fake_mapping_meta = {1: "a"}
        self.metric_id = 2

    def counter(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Union[int, float],
        tags: Mapping[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a counter metric for internal use cases only.
        Note that, as of now, this function will return
        immediately even if the metric message has not been
        produced to the broker yet.
        """

        counter_metric = {
            "mapping_meta": self.fake_mapping_meta,
            "metric_id": self.metric_id,
            "org_id": org_id,
            "project_id": project_id,
            "value": value,
            "timestamp": int(datetime.now().timestamp()),
            "tags": tags,
            "retention_days": get_retention_from_org_id(org_id),
            "type": "c",
            "use_case_id": use_case_id.value,
        }

        self.__send_request(counter_metric)

    def set(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[int],
        tags: Mapping[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a set metric for internal use cases only. Can support
        a sequence of values. Note that, as of now, this function
        will return immediately even if the metric message has not been
        produced to the broker yet.
        """

        set_metric = {
            "mapping_meta": self.fake_mapping_meta,
            "metric_id": self.metric_id,
            "org_id": org_id,
            "project_id": project_id,
            "value": value,
            "timestamp": int(datetime.now().timestamp()),
            "tags": tags,
            "retention_days": get_retention_from_org_id(org_id),
            "type": "s",
            "use_case_id": use_case_id.value,
        }

        self.__send_request(set_metric)

    def distribution(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[Union[int, float]],
        tags: Mapping[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a distribution metric for internal use cases only. Can
        support a sequence of values. Note that, as of now, this function
        will return immediately even if the metric message has not been
        produced to the broker yet.
        """
        dist_metric = {
            "mapping_meta": self.fake_mapping_meta,
            "metric_id": self.metric_id,
            "org_id": org_id,
            "project_id": project_id,
            "value": value,
            "timestamp": int(datetime.now().timestamp()),
            "tags": tags,
            "retention_days": get_retention_from_org_id(org_id),
            "type": "d",
            "use_case_id": use_case_id.value,
        }

        self.__send_request(dist_metric)

    def __send_request(self, metric: Mapping[str, Any]):
        # schema validation here
        serialized_metric = json.dumps(metric)
        metric_type = metric["type"]
        headers = {}
        entity = _METRIC_TYPE_TO_ENTITY[metric_type]
        try:
            resp = snuba._snuba_pool.urlopen(
                "POST",
                f"/tests/{entity}/eventstream",
                body=serialized_metric,
                headers={f"X-Sentry-{k}": v for k, v in headers.items()},
            )
            if resp.status != 200:
                raise snuba.SnubaError(
                    f"HTTP {resp.status} response from Snuba! {json.loads(resp.data)}"
                )
            return None
        except urllib3.exceptions.HTTPError as err:
            raise snuba.SnubaError(err)

    def close(self) -> None:
        """
        Calling this is required once we are done emitting metrics
        using the current instance of the KafkaMetricsBackend.
        """
        pass
