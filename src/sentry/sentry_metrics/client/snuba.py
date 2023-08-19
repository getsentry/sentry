from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Dict, Literal, Optional, Sequence, Union

import requests
import sentry_kafka_schemas
from django.conf import settings
from django.core.cache import cache

from sentry import quotas
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.aggregation_option_registry import AggregationOption  # NOQA:S007
from sentry.sentry_metrics.client.base import GenericMetricsBackend
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.use_case_id_registry import METRIC_PATH_MAPPING, UseCaseID
from sentry.utils import json


def build_mri(metric_name: str, type: str, use_case_id: UseCaseID, unit: Optional[str]) -> str:
    mri_unit = "none" if unit is None else unit
    return f"{type}:{use_case_id.value}/{metric_name}@{mri_unit}"


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


class SnubaMetricsBackend(GenericMetricsBackend):

    """
    This backend is meant for use in dev/testing
    environments. It allows for producing metrics
    to a Snuba HTTP endpoint, which will trigger
    processing and ultimately, insertion, of the
    metric into Clickhouse.
    """

    def _send_buckets(self, buckets, entity):
        if entity.startswith("generic_"):
            codec = sentry_kafka_schemas.get_codec("snuba-generic-metrics")
        else:
            codec = sentry_kafka_schemas.get_codec("snuba-metrics")

        for bucket in buckets:
            codec.validate(bucket)

        snuba_endpoint = "/tests/entities/{entity}/insert"

        assert (
            requests.post(
                settings.SENTRY_SNUBA + snuba_endpoint.format(entity=entity),
                data=json.dumps(buckets),
            ).status_code
            == 200
        )

    def _store_metric(
        self,
        org_id: int,
        project_id: int,
        type: Literal["counter", "set", "distribution"],
        name: str,
        tags: Dict[str, str],
        timestamp: int,
        value,
        use_case_id: UseCaseID,
        aggregation_option: Optional[AggregationOption] = None,
    ):
        mapping_meta = {}

        def metric_id(key: str):
            assert isinstance(key, str)
            res = indexer.record(
                use_case_id=use_case_id,
                org_id=org_id,
                string=key,
            )
            assert res is not None, key
            mapping_meta[str(res)] = key
            return res

        def tag_key(name):
            assert isinstance(name, str)
            res = indexer.record(
                use_case_id=use_case_id,
                org_id=org_id,
                string=name,
            )
            assert res is not None, name
            mapping_meta[str(res)] = name
            return str(res)

        def tag_value(name):
            assert isinstance(name, str)

            if METRIC_PATH_MAPPING[use_case_id] == UseCaseKey.PERFORMANCE:
                return name

            res = indexer.record(
                use_case_id=use_case_id,
                org_id=org_id,
                string=name,
            )
            assert res is not None, name
            mapping_meta[str(res)] = name
            return res

        assert not isinstance(value, list)

        if type == "set":
            # Relay uses a different hashing algorithm, but that's ok
            value = [int.from_bytes(hashlib.md5(str(value).encode()).digest()[:8], "big")]
        elif type == "distribution":
            value = [value]

        msg = {
            "org_id": org_id,
            "project_id": project_id,
            "metric_id": metric_id(name),
            "timestamp": timestamp,
            "tags": {tag_key(key): tag_value(value) for key, value in tags.items()},
            "type": {"counter": "c", "set": "s", "distribution": "d"}[type],
            "value": value,
            "retention_days": 90,
            "use_case_id": use_case_id.value,
            # making up a sentry_received_timestamp, but it should be sometime
            # after the timestamp of the event
            "sentry_received_timestamp": timestamp + 10,
            "version": 2 if METRIC_PATH_MAPPING[use_case_id] == UseCaseKey.PERFORMANCE else 1,
        }

        msg["mapping_meta"] = {}
        msg["mapping_meta"][msg["type"]] = mapping_meta

        if aggregation_option:
            msg["aggregation_option"] = aggregation_option.value

        if METRIC_PATH_MAPPING[use_case_id] == UseCaseKey.PERFORMANCE:
            entity = f"generic_metrics_{type}s"
        else:
            entity = f"metrics_{type}s"

        self._send_buckets([msg], entity)

    def counter(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Union[int, float],
        tags: Dict[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a counter metric for internal use cases only.
        """

        self._store_metric(
            name=build_mri(metric_name, "c", use_case_id, unit),
            tags=tags,
            value=value,
            org_id=org_id,
            project_id=project_id,
            type="counter",
            timestamp=int(datetime.now().timestamp()),
            use_case_id=use_case_id,
        )

    def set(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[int],
        tags: Dict[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a set metric for internal use cases only. Can support
        a sequence of values.
        """

        for val in value:
            self._store_metric(
                name=build_mri(metric_name, "s", use_case_id, unit),
                tags=tags,
                value=val,
                org_id=org_id,
                project_id=project_id,
                type="set",
                timestamp=int(datetime.now().timestamp()),
                use_case_id=use_case_id,
            )

    def distribution(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[Union[int, float]],
        tags: Dict[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a distribution metric for internal use cases only. Can
        support a sequence of values.
        """
        for val in value:
            self._store_metric(
                name=build_mri(metric_name, "d", use_case_id, unit),
                tags=tags,
                value=val,
                org_id=org_id,
                project_id=project_id,
                type="distribution",
                timestamp=int(datetime.now().timestamp()),
                use_case_id=use_case_id,
            )

    def close(self) -> None:
        """
        Calling this is not required and is mostly for usage in tests
        """
        pass
