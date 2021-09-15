from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional, Sequence, cast

from snuba_sdk import Column, Condition, Entity, Op, Query
from snuba_sdk.expressions import Granularity

from sentry.releasehealth.base import ReleaseHealthBackend
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.base import UseCase
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_query, raw_snql_query


def metric_id(org_id: int, name: str) -> int:
    return indexer.resolve(org_id, UseCase.TAG_KEY, name)


def tag_key(org_id: int, name: str) -> str:
    index = indexer.resolve(org_id, UseCase.TAG_KEY, name)
    return f"tags[{index}]"


def tag_value(org_id: int, name: str) -> int:
    return indexer.resolve(org_id, UseCase.TAG_VALUE, name)


class MetricsReleaseHealthBackend(ReleaseHealthBackend):
    """Gets release health results from the metrics dataset"""

    def get_current_and_previous_crash_free_rates(
        self,
        org_id: int,
        project_ids: Sequence[int],
        current_start: datetime,
        current_end: datetime,
        previous_start: datetime,
        previous_end: datetime,
        rollup: int,
    ) -> ReleaseHealthBackend.CurrentAndPreviousCrashFreeRates:
        projects_crash_free_rate_dict: ReleaseHealthBackend.CurrentAndPreviousCrashFreeRates = {
            prj: {"currentCrashFreeRate": None, "previousCrashFreeRate": None}
            for prj in project_ids
        }

        previous = self._get_crash_free_rate_data(
            org_id,
            project_ids,
            previous_start,
            previous_end,
            rollup,
        )

        for project_id, project_data in previous.items():
            projects_crash_free_rate_dict[project_id][
                "previousCrashFreeRate"
            ] = self._compute_crash_free_rate(project_data)

        current = self._get_crash_free_rate_data(
            org_id,
            project_ids,
            current_start,
            current_end,
            rollup,
        )

        return projects_crash_free_rate_dict

    @staticmethod
    def _get_crash_free_rate_data(
        org_id: int,
        project_ids: Sequence[int],
        start: datetime,
        end: datetime,
        rollup: int,
    ) -> Mapping[int, Dict[str, float]]:

        data = {}

        session_status = tag_key(org_id, "session.status")

        count_query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity("metrics_counters"),
            select=[Column("value")],
            where=[
                Condition(Column("org_id"), Op.EQ, org_id),
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
            ],
            groupby=[
                Column("project_id"),
                Column(session_status),
            ],
            granularity=Granularity(rollup),
        )

        # TODO: Add appropriate referrer
        count_data = raw_snql_query(count_query, use_cache=False)["data"]

        for row in count_data:
            project_data = data.setdefault(row["project_id"], {})
            tag_value = reverse_tag_value(org_id, row[session_status])
            if tag_value is not None:
                project_data[tag_value] = row["value"]

        set_query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity("metrics_sets"),
            select=[Column("value")],  # count_unique
            where=[
                Condition(Column("org_id"), Op.EQ, org_id),
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session.error")),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
            ],
            groupby=[Column("project_id")],
            granularity=Granularity(rollup),
        )

        set_data = raw_snql_query(set_query, use_cache=False)["data"]

        for row in set_data:
            project_data = data.setdefault(row["project_id"], {})
            project_data["errored"] = row["value"]

        return data

    @staticmethod
    def _compute_crash_free_rate(data: Dict[str, float]) -> Optional[float]:
        total_session_count = data.get("init", 0)
        crash_count = data.get("crashed", 0)

        if total_session_count == 0:
            return None

        crash_free_rate = 1.0 - (crash_count / total_session_count)

        # If crash count is larger than total session count for some reason
        crash_free_rate = max(0.0, crash_free_rate)

        return crash_free_rate
