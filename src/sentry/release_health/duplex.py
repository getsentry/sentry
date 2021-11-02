import inspect
from copy import deepcopy
from datetime import datetime
from typing import Mapping, Optional, Sequence, Set, Union

from typing_extensions import Literal

from sentry.release_health.base import (
    CrashFreeBreakdown,
    CurrentAndPreviousCrashFreeRates,
    EnvironmentName,
    OrganizationId,
    OverviewStat,
    ProjectId,
    ProjectOrRelease,
    ProjectRelease,
    ProjectReleaseSessionStats,
    ProjectReleaseUserStats,
    ProjectWithCount,
    ReleaseHealthBackend,
    ReleaseHealthOverview,
    ReleaseName,
    ReleasesAdoption,
    ReleaseSessionsTimeBounds,
    SessionsQueryResult,
    StatsPeriod,
)
from sentry.release_health.metrics import MetricsReleaseHealthBackend
from sentry.release_health.sessions import SessionsReleaseHealthBackend
from sentry.snuba.sessions_v2 import QueryDefinition


def _get_calling_method():
    """
    This assumes the method is the second function on the frame
    (as is the case when called for compare_results and log_exception)
    :return:
    """
    return inspect.stack()[2].function


def compare_results(result, right, ignore=None):
    pass


def log_exception(ex, result):
    pass


class DuplexReleaseHealthBackend(ReleaseHealthBackend):
    def __init__(
        self,
        session: SessionsReleaseHealthBackend,
        metrics: MetricsReleaseHealthBackend,
        metrics_start: datetime,
    ):
        self.session = session
        self.metrics = metrics
        self.metrics_start = metrics_start

    def get_current_and_previous_crash_free_rates(
        self,
        project_ids: Sequence[ProjectId],
        current_start: datetime,
        current_end: datetime,
        previous_start: datetime,
        previous_end: datetime,
        rollup: int,
        org_id: Optional[OrganizationId] = None,
    ) -> CurrentAndPreviousCrashFreeRates:

        ret_val = self.session.get_current_and_previous_crash_free_rates(
            project_ids, current_start, current_end, previous_start, previous_end, rollup, org_id
        )

        if previous_start > self.metrics_start:
            copy = deepcopy(ret_val)
            try:
                metrics_val = self.metrics.get_current_and_previous_crash_free_rates(
                    project_ids,
                    current_start,
                    current_end,
                    previous_start,
                    previous_end,
                    rollup,
                    org_id,
                )
            except Exception as ex:
                log_exception(ex, copy)
            else:
                compare_results(copy, metrics_val)
        return ret_val

    def get_release_adoption(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
        org_id: Optional[OrganizationId] = None,
    ) -> ReleasesAdoption:
        ret_val = self.session.get_release_adoption(project_releases, environments, now, org_id)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_release_adoption(
                project_releases, environments, now, org_id
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def run_sessions_query(
        self,
        org_id: int,
        query: QueryDefinition,
        span_op: str,
    ) -> SessionsQueryResult:
        ret_val = self.session.run_sessions_query(org_id, query, span_op)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.run_sessions_query(org_id, query, span_op)
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_release_sessions_time_bounds(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        org_id: OrganizationId,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleaseSessionsTimeBounds:
        ret_val = self.session.get_release_sessions_time_bounds(
            project_id, release, org_id, environments
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_release_sessions_time_bounds(
                project_id, release, org_id, environments
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def check_has_health_data(
        self, projects_list: Sequence[ProjectOrRelease]
    ) -> Set[ProjectOrRelease]:
        ret_val = self.session.check_has_health_data(projects_list)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.check_has_health_data(projects_list)
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def check_releases_have_health_data(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        release_versions: Sequence[ReleaseName],
        start: datetime,
        end: datetime,
    ) -> Set[ReleaseName]:
        ret_val = self.session.check_releases_have_health_data(
            organization_id, project_ids, release_versions, start, end
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.check_releases_have_health_data(
                organization_id, project_ids, release_versions, start, end
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_release_health_data_overview(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        summary_stats_period: Optional[StatsPeriod] = None,
        health_stats_period: Optional[StatsPeriod] = None,
        stat: Optional[Literal["users", "sessions"]] = None,
    ) -> Mapping[ProjectRelease, ReleaseHealthOverview]:
        ret_val = self.session.get_release_health_data_overview(
            project_releases, environments, summary_stats_period, health_stats_period, stat
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_release_health_data_overview(
                project_releases, environments, summary_stats_period, health_stats_period, stat
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_crash_free_breakdown(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> Sequence[CrashFreeBreakdown]:
        ret_val = self.session.get_crash_free_breakdown(project_id, release, start, environments)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_crash_free_breakdown(
                project_id, release, start, environments
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_changed_project_release_model_adoptions(
        self,
        project_ids: Sequence[ProjectId],
    ) -> Sequence[ProjectRelease]:
        ret_val = self.session.get_changed_project_release_model_adoptions(project_ids)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_changed_project_release_model_adoptions(project_ids)
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_oldest_health_data_for_releases(
        self, project_releases: Sequence[ProjectRelease]
    ) -> Mapping[ProjectRelease, str]:
        ret_val = self.session.get_oldest_health_data_for_releases(project_releases)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_oldest_health_data_for_releases(project_releases)
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_project_releases_count(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> int:
        ret_val = self.session.get_project_releases_count(
            organization_id, project_ids, scope, stats_period, environments
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_project_releases_count(
                organization_id, project_ids, scope, stats_period, environments
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_project_release_stats(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        stat: OverviewStat,
        rollup: int,
        start: datetime,
        end: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> Union[ProjectReleaseUserStats, ProjectReleaseSessionStats]:
        raise NotImplementedError()

    def get_project_sessions_count(
        self,
        project_id: ProjectId,
        rollup: int,  # rollup in seconds
        start: datetime,
        end: datetime,
        environment_id: Optional[int] = None,
    ) -> int:
        ret_val = self.session.get_project_sessions_count(
            project_id, rollup, start, end, environment_id
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_project_sessions_count(
                project_id, rollup, start, end, environment_id
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_num_sessions_per_project(
        self,
        project_ids: Sequence[ProjectId],
        start: datetime,
        end: datetime,
        environment_ids: Optional[Sequence[int]] = None,
        rollup: Optional[int] = None,  # rollup in seconds
    ) -> Sequence[ProjectWithCount]:
        ret_val = self.session.get_num_sessions_per_project(
            project_ids, start, end, environment_ids, rollup
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_num_sessions_per_project(
                project_ids, start, end, environment_ids, rollup
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_project_releases_by_stability(
        self,
        project_ids: Sequence[ProjectId],
        offset: Optional[int],
        limit: Optional[int],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[str]] = None,
    ) -> Sequence[ProjectRelease]:
        ret_val = self.session.get_project_releases_by_stability(
            project_ids, offset, limit, scope, stats_period, environments
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_project_releases_by_stability(
                project_ids, offset, limit, scope, stats_period, environments
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val


# TESTING how we cold do it automatically
import types


def generate_method(name):
    def meth(self, *args, **kwargs):
        session_meth = SessionsReleaseHealthBackend.__dict__[name]
        ret_val = session_meth(self.session, *args, **kwargs)
        copy = deepcopy(ret_val)
        try:
            metrics_meth = MetricsReleaseHealthBackend.__dict__[name]
            metrics_ret_val = metrics_meth(self.metrics, *args, **kwargs)
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(ret_val, metrics_ret_val)
        return ret_val

    return meth


def create_methods(cls):
    def __init__(self, session: SessionsReleaseHealthBackend, metrics: MetricsReleaseHealthBackend):
        self.session = session
        self.metrics = metrics

    cls["__init__"] = __init__
    for name, field in ReleaseHealthBackend.__dict__.items():
        if isinstance(field, types.FunctionType):
            cls[name] = generate_method(name)


AutoDuplex = types.new_class("AutoDup", (ReleaseHealthBackend,), exec_body=create_methods)
