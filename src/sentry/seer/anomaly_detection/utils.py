from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone
from django.utils.datastructures import MultiValueDict

from sentry import release_health
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleThresholdType
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.types import SnubaParams
from sentry.seer.anomaly_detection.types import TimeSeriesPoint
from sentry.snuba import metrics_performance
from sentry.snuba.models import SnubaQuery
from sentry.snuba.referrer import Referrer
from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.snuba.utils import get_dataset
from sentry.utils.snuba import SnubaTSResult


def translate_direction(direction: int) -> str:
    """
    Temporary translation map to Seer's expected values
    """
    direction_map = {
        AlertRuleThresholdType.ABOVE: "up",
        AlertRuleThresholdType.BELOW: "down",
        AlertRuleThresholdType.ABOVE_AND_BELOW: "both",
    }
    return direction_map[AlertRuleThresholdType(direction)]


NUM_DAYS = 28


def get_crash_free_historical_data(
    start: datetime, end: datetime, project: Project, organization: Organization, granularity: int
):
    """
    Fetch the historical metrics data from Snuba for crash free user rate and crash free session rate metrics
    """

    params = {
        "start": start,
        "end": end,
        "project_id": [project.id],
        "project_objects": [project],
        "organization_id": organization.id,
    }
    query_params: MultiValueDict[str, Any] = MultiValueDict(
        {
            "project": [project.id],
            "statsPeriod": [f"{NUM_DAYS}d"],
            "field": ["sum(session)"],
            "groupBy": ["release"],
        }
    )
    query = QueryDefinition(
        query=query_params,
        params=params,
        offset=None,
        limit=None,
        query_config=release_health.backend.sessions_query_config(organization),
    )
    result = release_health.backend.run_sessions_query(
        organization.id, query, span_op="sessions.anomaly_detection"
    )
    return SnubaTSResult(
        {
            "data": result,
        },
        result.get("start"),
        result.get("end"),
        granularity,
    )


def format_historical_data(data: SnubaTSResult, dataset: Any) -> list[TimeSeriesPoint]:
    """
    Format Snuba data into the format the Seer API expects.
    For errors/transactions data:
        If there are no results, it's just the timestamp
        {'time': 1719012000}, {'time': 1719018000}, {'time': 1719024000}

        If there are results, the aggregate is added
        {'time': 1721300400, 'count': 2}

    For metrics_performance dataset/sessions data:
        The count is stored separately from the timestamps, if there is no data the count is 0
    """
    formatted_data: list[TimeSeriesPoint] = []
    nested_data = data.data.get("data", [])

    if dataset == metrics_performance:
        groups = nested_data.get("groups")
        if not len(groups):
            return formatted_data
        series = groups[0].get("series")

        for time, count in zip(nested_data.get("intervals"), series.get("sum(session)", 0)):
            date = datetime.strptime(time, "%Y-%m-%dT%H:%M:%SZ")
            ts_point = TimeSeriesPoint(timestamp=date.timestamp(), value=count)
            formatted_data.append(ts_point)
    else:
        # we don't know what the aggregation key of the query is
        # so we should see it when we see a data point that has a value
        agg_key = ""
        for datum in nested_data:
            if len(datum) == 1:
                # this data point has no value
                ts_point = TimeSeriesPoint(timestamp=datum.get("time"), value=0)
            else:
                # if we don't know the aggregation key yet, we should set it
                if not agg_key:
                    for key in datum:  # only two keys in this dict
                        if key != "time":
                            agg_key = key
                            break
                ts_point = TimeSeriesPoint(timestamp=datum.get("time"), value=datum.get(agg_key, 0))
            formatted_data.append(ts_point)
    return formatted_data


def fetch_historical_data(
    alert_rule: AlertRule,
    snuba_query: SnubaQuery,
    project: Project,
    start: datetime | None = None,
    end: datetime | None = None,
) -> SnubaTSResult | None:
    """
    Fetch 28 days of historical data from Snuba to pass to Seer to build the anomaly detection model
    """
    # TODO: if we can pass the existing timeseries data we have on the front end along here, we can shorten
    # the time period we query and combine the data
    is_store_data_request = False
    if end is None:
        is_store_data_request = True
        end = timezone.now()
    # doing it this way to suppress typing errors
    if start is None:
        start = end - timedelta(days=NUM_DAYS)
    granularity = snuba_query.time_window

    dataset_label = snuba_query.dataset
    if dataset_label == "events":
        # DATASET_OPTIONS expects the name 'errors'
        dataset_label = "errors"
    elif dataset_label == "generic_metrics":
        dataset_label = "transactions"
    dataset = get_dataset(dataset_label)

    if not project or not dataset or not alert_rule.organization:
        return None

    if dataset == metrics_performance:
        return get_crash_free_historical_data(
            start, end, project, alert_rule.organization, granularity
        )

    else:
        historical_data = dataset.timeseries_query(
            selected_columns=[snuba_query.aggregate],
            query=snuba_query.query,
            snuba_params=SnubaParams(
                organization=alert_rule.organization,
                projects=[project],
                start=start,
                end=end,
            ),
            rollup=granularity,
            referrer=(
                Referrer.ANOMALY_DETECTION_HISTORICAL_DATA_QUERY.value
                if is_store_data_request
                else Referrer.ANOMALY_DETECTION_RETURN_HISTORICAL_ANOMALIES.value
            ),
            zerofill_results=True,
        )
    return historical_data
