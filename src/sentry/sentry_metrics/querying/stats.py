from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from django.http import QueryDict

from sentry.api.utils import get_date_range_from_params
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.data import MQLQuery, run_queries
from sentry.sentry_metrics.querying.data.transformation.stats import MetricsOutcomesTransformer
from sentry.snuba.referrer import Referrer
from sentry.snuba.sessions_v2 import InvalidField
from sentry.utils.dates import parse_stats_period

METRIC_OUTCOME_AGGREGATE = "sum(c:metric_stats/volume@none)"
METRIC_CARDINALITY_AGGREGATE = "max(g:metric_stats/cardinality@none){cardinality.window:3600}"


def _get_mql_string(aggregate: str, group_by: Sequence[str]) -> str:

    # TODO(metrics): add support for reason tag
    group_by_tags = []
    if "outcome" in group_by:
        group_by_tags.append("outcome.id")
    if "project" in group_by:
        group_by_tags.append("project_id")

    if group_by_tags:
        return f"{aggregate} by ({', '.join(group_by_tags)})"

    return aggregate


def _run_metrics_outcomes_query(
    start: datetime,
    end: datetime,
    group_by: Sequence[str],
    interval,
    organization: Organization,
    projects: Sequence[Project],
    environments: Sequence[Environment],
):

    mql_string = _get_mql_string(METRIC_OUTCOME_AGGREGATE, group_by)

    rows = run_queries(
        mql_queries=[MQLQuery(mql_string)],
        start=start,
        end=end,
        interval=int(3600 if interval is None else interval.total_seconds()),
        organization=organization,
        projects=projects,
        environments=environments,
        referrer=Referrer.OUTCOMES_TIMESERIES.value,
    ).apply_transformer(MetricsOutcomesTransformer())

    return rows


def _run_metrics_cardinality_query(
    start: datetime,
    end: datetime,
    group_by: Sequence[str],
    interval,
    organization: Organization,
    projects: Sequence[Project],
    environments: Sequence[Environment],
):

    if not interval:
        interval = 3600
    elif interval.total_seconds() < 3600:
        interval = 3600
    else:
        interval = interval.total_seconds()

    mql_string = _get_mql_string(METRIC_CARDINALITY_AGGREGATE, group_by)

    rows = run_queries(
        mql_queries=[MQLQuery(mql_string)],
        start=start,
        end=end,
        interval=interval,
        organization=organization,
        projects=projects,
        environments=environments,
        referrer=Referrer.OUTCOMES_TIMESERIES.value,
    ).apply_transformer(MetricsOutcomesTransformer())

    return rows


def run_metric_stats_query(
    query: QueryDict,
    organization: Organization,
    projects: Sequence[Project],
    environments: Sequence[Environment],
):

    start, end = get_date_range_from_params(query)
    group_by = query.getlist("groupBy", [])
    interval = parse_stats_period(query.get("interval", "1h"))

    category = query.get("category")
    # TODO(metrics): remove  metricsSeconds after FE is updated
    if category == "metricSecond" or category == "metricOutcomes":
        return _run_metrics_outcomes_query(
            start=start,
            end=end,
            group_by=group_by,
            interval=interval,
            environments=environments,
            organization=organization,
            projects=projects,
        )

    raise InvalidField(f'Invalid category: "{category}"')
