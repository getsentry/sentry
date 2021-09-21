from datetime import datetime
from typing import Dict, Optional, Sequence, Set

from snuba_sdk import Column, Condition, Entity, Op, Query
from snuba_sdk.expressions import Granularity

from sentry.models.project import Project
from sentry.releasehealth.base import (
    CurrentAndPreviousCrashFreeRates,
    ProjectList,
    ProjectRelease,
    ReleaseHealthBackend,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.base import UseCase
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_snql_query


def metric_id(org_id: int, name: str) -> int:
    index = indexer.resolve(org_id, UseCase.TAG_KEY, name)  # type: ignore
    assert index is not None  # TODO: assert too strong?
    return index  # type: ignore


def tag_key(org_id: int, name: str) -> str:
    index = indexer.resolve(org_id, UseCase.TAG_KEY, name)  # type: ignore
    assert index is not None
    return f"tags[{index}]"


def tag_value(org_id: int, name: str) -> int:
    index = indexer.resolve(org_id, UseCase.TAG_VALUE, name)  # type: ignore
    assert index is not None
    return index  # type: ignore


def reverse_tag_value(org_id: int, index: int) -> str:
    str_value = indexer.reverse_resolve(org_id, UseCase.TAG_VALUE, index)  # type: ignore
    assert str_value is not None
    return str_value  # type: ignore


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
        org_id: Optional[int] = None,
    ) -> CurrentAndPreviousCrashFreeRates:
        if org_id is None:
            org_id = self._get_org_id(project_ids)

        projects_crash_free_rate_dict: CurrentAndPreviousCrashFreeRates = {
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

        for project_id, project_data in current.items():
            projects_crash_free_rate_dict[project_id][
                "currentCrashFreeRate"
            ] = self._compute_crash_free_rate(project_data)

        return projects_crash_free_rate_dict

    @staticmethod
    def _get_org_id(project_ids: Sequence[int]) -> int:
        projects = Project.objects.get_many_from_cache(project_ids)
        org_ids: Set[int] = {project.organization_id for project in projects}
        if len(org_ids) != 1:
            raise ValueError("Expected projects to be from the same organization")

        return org_ids.pop()

    @staticmethod
    def _get_crash_free_rate_data(
        org_id: int,
        project_ids: Sequence[int],
        start: datetime,
        end: datetime,
        rollup: int,
    ) -> Dict[int, Dict[str, float]]:

        data: Dict[int, Dict[str, float]] = {}

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

        count_data = raw_snql_query(
            count_query, referrer="releasehealth.metrics.get_crash_free_data", use_cache=False
        )["data"]

        for row in count_data:
            project_data = data.setdefault(row["project_id"], {})
            tag_value = reverse_tag_value(org_id, row[session_status])
            project_data[tag_value] = row["value"]

        return data

    @staticmethod
    def _compute_crash_free_rate(data: Dict[str, float]) -> Optional[float]:
        total_session_count = data.get("init", 0)
        crash_count = data.get("crashed", 0)

        if total_session_count == 0:
            return None

        crash_free_rate = 1.0 - (crash_count / total_session_count)

        # If crash count is larger than total session count for some reason
        crash_free_rate = 100 * max(0.0, crash_free_rate)

        return crash_free_rate

    def check_has_health_data(self, projects_list: ProjectList) -> Set[ProjectRelease]:

        # TODO implement
        raise NotImplementedError()
