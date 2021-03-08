from rest_framework.response import Response
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.utils import get_date_range_rollup_from_params
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Project, Team

from sentry.snuba import outcomes
from sentry_relay import DataCategory
from sentry.utils.outcomes import Outcome
from collections import defaultdict
import collections.abc

from sentry.utils.snuba import (
    naiveify_datetime,
    to_naive_timestamp,
)


CATEGORY_NAME_MAP = {
    DataCategory.ERROR: "statsErrors",
    DataCategory.TRANSACTION: "statsTransactions",
    DataCategory.ATTACHMENT: "statsAttachments",
}

DEFAULT_TS_VAL = {
    "accepted": {"quantity": 0, "times_seen": 0},
    "filtered": {"quantity": 0, "times_seen": 0},
    "dropped": {
        "overQuota": {"quantity": 0, "times_seen": 0},
        "spikeProtection": {"quantity": 0, "times_seen": 0},
        "other": {"quantity": 0, "times_seen": 0},
    },
}


class OrganizationStatsEndpointV2(OrganizationEndpoint):
    def get(self, request, organization):
        start, end, rollup = get_date_range_rollup_from_params(request.GET, "1h", round_range=True)
        result = outcomes.query(
            start=start,
            end=end,
            rollup=rollup,
            groupby=["category", "time", "outcome", "reason"],
            aggregations=[["sum", "times_seen", "times_seen"], ["sum", "quantity", "quantity"]],
            filter_keys={"org_id": [organization.id]},
            orderby=["time"],
        )

        response = {
            "statsErrors": defaultdict(lambda: DEFAULT_TS_VAL),
            "statsTransactions": defaultdict(lambda: DEFAULT_TS_VAL),
            "statsAttachments": defaultdict(lambda: DEFAULT_TS_VAL),
        }
        for row in result:
            nested_update(
                response[CATEGORY_NAME_MAP[row["category"]]][row["time"]], map_row_to_format(row)
            )

        response = {
            category: zerofill(list(val.values()), start, end, rollup, "time")
            for category, val in response.items()
        }
        return Response(response)


class OrganizationProjectStatsIndex(OrganizationEndpoint):
    def get(self, request, organization):
        start, end, rollup = get_date_range_rollup_from_params(request.GET, "1h", round_range=True)

        # TODO: see if there's a better way to get the user's projects
        project_list = []
        team_list = Team.objects.get_for_user(organization=organization, user=request.user)
        for team in team_list:
            project_list.extend(Project.objects.get_for_user(team=team, user=request.user))
        project_ids = list({p.id for p in project_list})

        result = outcomes.query(
            start=start,
            end=end,
            rollup=rollup,
            groupby=["project_id", "category", "time", "outcome", "reason"],
            aggregations=[["sum", "times_seen", "times_seen"], ["sum", "quantity", "quantity"]],
            filter_keys={"org_id": [organization.id], "project_id": project_ids},
            orderby=["times_seen", "time"],
        )
        template = {
            "statsErrors": defaultdict(lambda: DEFAULT_TS_VAL),
            "statsTransactions": defaultdict(lambda: DEFAULT_TS_VAL),
            "statsAttachments": defaultdict(lambda: DEFAULT_TS_VAL),
        }
        # need deepcopy here?
        # response = defaultdict(lambda: template)
        response = {project_id: template.copy() for project_id in project_ids}

        # group results by projectid>timestamp, using defaultdict to coalesce into format
        for row in result:
            nested_update(
                response[row["project_id"]][CATEGORY_NAME_MAP[row["category"]]][row["time"]],
                map_row_to_format(row),
            )
        # add project_ids with no results to dict
        for project_id in project_ids:
            if project_id not in response:
                response[project_id] = template.copy()

        # zerofill response
        response = {
            project_id: {
                category: zerofill(list(stats.values()), start, end, rollup, "time")
                for category, stats in timeseries.items()
            }
            for project_id, timeseries in response.items()
        }
        return Response(response)


class OrganizationProjectStatsDetails(OrganizationEndpoint, ProjectEndpoint):
    def get(self, request, project, organization):
        start, end, rollup = get_date_range_rollup_from_params(request.GET, "1h", round_range=True)

        # TODO: see if there's a better way to get the user's projects
        project_list = []
        team_list = Team.objects.get_for_user(organization=organization, user=request.user)
        for team in team_list:
            project_list.extend(Project.objects.get_for_user(team=team, user=request.user))
        project_ids = list({p.id for p in project_list})

        if project.id not in project_ids:
            return Response(status=404)

        result = outcomes.query(
            start=start,
            end=end,
            rollup=rollup,
            groupby=["category", "time", "outcome", "reason"],
            aggregations=[["sum", "times_seen", "times_seen"], ["sum", "quantity", "quantity"]],
            filter_keys={"org_id": [project.organization.id], "project_id": [project.id]},
            orderby=["time"],
        )

        # need deepcopy here?
        response = {
            "statsErrors": defaultdict(lambda: DEFAULT_TS_VAL.copy()),
            "statsTransactions": defaultdict(lambda: DEFAULT_TS_VAL.copy()),
            "statsAttachments": defaultdict(lambda: DEFAULT_TS_VAL.copy()),
        }
        for row in result:
            nested_update(
                response[CATEGORY_NAME_MAP[row["category"]]][row["time"]], map_row_to_format(row)
            )

        response = {
            category: zerofill(list(val.values()), start, end, rollup, "time")
            for category, val in response.items()
        }
        return Response(response)


def outcome_to_string(outcome):
    # TODO: why do we rename this?
    return "dropped" if outcome == Outcome.RATE_LIMITED else Outcome(outcome).api_name()


def rate_limited_reason_mapper(reason):
    # billing logic ported over. TODO: combine usages of this into some abstracted module?
    if reason in {"usage_exceeded", "grace_period"}:
        reason_val = "overQuota"
    elif reason == "smart_rate_limit":
        reason_val = "spikeProtection"
    else:
        reason_val = "other"
    return reason_val


# TODO: add ts and date fields to replace "timestamp" field


def map_row_to_format(row):
    obj = {"time": row["time"]}
    if row["outcome"] == Outcome.RATE_LIMITED:
        obj[outcome_to_string(row["outcome"])] = {
            rate_limited_reason_mapper(row["reason"]): {
                "quantity": row["quantity"],
                "times_seen": row["times_seen"],
            }
        }
    else:
        obj[outcome_to_string(row["outcome"])] = {
            "quantity": row["quantity"],
            "times_seen": row["times_seen"],
        }
    return obj


def nested_update(d, u):
    # https://stackoverflow.com/a/3233356
    for k, v in u.items():
        if isinstance(v, collections.abc.Mapping):
            d[k] = nested_update(d.get(k, {}), v)
        else:
            d[k] = v
    return d


def zerofill(data, start, end, rollup, orderby):
    rv = []
    start = int(to_naive_timestamp(naiveify_datetime(start)) / rollup) * rollup
    end = (int(to_naive_timestamp(naiveify_datetime(end)) / rollup) * rollup) + rollup
    data_by_time = {}

    for obj in data:
        if obj["time"] in data_by_time:
            data_by_time[obj["time"]].append(obj)
        else:
            data_by_time[obj["time"]] = [obj]
    for key in range(start, end, rollup):
        if key in data_by_time and len(data_by_time[key]) > 0:
            rv = rv + data_by_time[key]
            data_by_time[key] = []
        else:
            val = DEFAULT_TS_VAL.copy()
            val["time"] = key
            rv.append(val)

    if "-time" in orderby:
        return list(reversed(rv))
    return rv
