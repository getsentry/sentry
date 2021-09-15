from datetime import datetime
from typing import Any, Dict, Mapping, Optional, Sequence, cast

from snuba_sdk import Column, Condition, Entity, Op, Query
from snuba_sdk.expressions import Granularity

from sentry.releasehealth.base import ReleaseHealthBackend
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_query


class MetricsReleaseHealthBackend(ReleaseHealthBackend):
    """Gets release health results from the metrics dataset"""

    def get_current_and_previous_crash_free_rates(
        self,
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

        metric_ids = {
            metric_name: indexer.resolve(org_id, UseCase.METRIC, metric_name)
            for metric_name in ("session",)
        }

        previous = self._get_crash_free_rate_data(
            project_ids, previous_start, previous_end, rollup, metric_ids
        )
        current = self._get_crash_free_rate_data(
            project_ids, current_start, current_end, rollup, metric_ids
        )
        return projects_crash_free_rate_dict

    @staticmethod
    def _get_crash_free_rate_data(
        org_id: int,
        project_ids: Sequence[int],
        start: datetime,
        end: datetime,
        rollup: int,
        metric_ids: Dict[str, int],
    ) -> Sequence[Mapping[str, Any]]:

        snql_counters = Query(
            dataset=Dataset.Metrics,
            match=Entity("metrics_counters"),
            where=[
                Condition(Column("org_id"), Op.EQ, org_id),
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("metric_id"), Op.EQ, metric_ids["session"]),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
            ],
            granularity=Granularity(rollup),
        )
