from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence, Set, Tuple, Union

import pytz
from snuba_sdk import BooleanCondition, Column, Condition, Entity, Op, Query
from snuba_sdk.expressions import Granularity

from sentry.models.project import Project
from sentry.releasehealth.base import ReleaseHealthBackend
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
    ) -> ReleaseHealthBackend.CurrentAndPreviousCrashFreeRates:
        if org_id is None:
            org_id = self._get_org_id(project_ids)

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

    @staticmethod
    def _get_conditions_and_filter_keys(
        project_releases: Sequence[Tuple[int, str]], environments: Sequence[str]
    ):
        pass

    def get_release_adoption(
        self,
        project_releases: Sequence[Tuple[int, str]],
        environments: Optional[Sequence[str]] = None,
        now=None,
        org_id: Optional[int] = None,
    ):
        project_ids = list({x[0] for x in project_releases})
        if org_id is None:
            org_id = self._get_org_id(project_ids)

        if now is None:
            now = datetime.now(pytz.utc)
        start = now - timedelta(days=1)

        # Total user count and session count for our given list of
        # environments, per-project.
        total_where_common: List[Union[BooleanCondition, Condition]] = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, now),
            Condition(Column(tag_key(org_id, "session.status")), Op.EQ, tag_value(org_id, "init")),
        ]

        # Count of all sessions for given list of environments and timerange, per-project
        total_sessions_query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity("metrics_counters"),
            select=[Column("value")],
            where=total_where_common
            + [
                Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
            ],
            groupby=[
                Column("project_id"),
            ],
        )

        total_sessions = {
            x["project_id"]: x["value"]
            for x in raw_snql_query(
                total_sessions_query,
                referrer="releasehealth.metrics.get_release_adoption.total_sessions",
                use_cache=False,
            )["data"]
        }

        # Count of users for given list of environments and timerange, per-project
        total_users_query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity("metrics_sets"),
            select=[Column("value")],
            where=total_where_common
            + [
                Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "user")),
            ],
            groupby=[
                Column("project_id"),
            ],
        )

        total_users = {
            x["project_id"]: x["value"]
            for x in raw_snql_query(
                total_sessions_query,
                referrer="releasehealth.metrics.get_release_adoption.total_users",
                use_cache=False,
            )["data"]
        }

        import pdb

        pdb.set_trace()
        # TODO

        return {}
