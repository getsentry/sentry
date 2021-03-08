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


# TODO: add this onto the outcomes module?
OUTCOME_TO_STR = {
    Outcome.ACCEPTED: "accepted",
    Outcome.FILTERED: "filtered",
    Outcome.RATE_LIMITED: "dropped",
}


CATEGORY_NAME_MAP = {
    DataCategory.ERROR: "statsErrors",
    DataCategory.TRANSACTION: "statsTransactions",
    DataCategory.ATTACHMENT: "statsAttachments",
}


DEFAULT_TS_VAL = [
    ("accepted", {"quantity": 0, "times_seen": 0}),
    ("filtered", {"quantity": 0, "times_seen": 0}),
    (
        "dropped",
        {
            "overQuota": {"quantity": 0, "times_seen": 0},
            "spikeProtection": {"quantity": 0, "times_seen": 0},
            "other": {"quantity": 0, "times_seen": 0},
        },
    ),
]


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

        # TODO: see if you can use a regular dict in lambda
        response = {
            "statsErrors": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsTransactions": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsAttachments": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
        }
        for row in result:
            if "category" in row:
                uniq_key = row["time"]
                update(response[CATEGORY_NAME_MAP[row["category"]]][uniq_key], datamapper(row))

        response = {
            category: outcomes.zerofill(list(val.values()), start, end, rollup, "time")
            for category, val in response.items()
        }
        return Response(response)


class OrganizationProjectStatsIndex(OrganizationEndpoint):
    def get(self, request, organization):
        start, end, rollup = get_date_range_rollup_from_params(request.GET, "1h", round_range=True)

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
            "statsErrors": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsTransactions": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsAttachments": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
        }
        # need .copy here?
        # response = defaultdict(lambda: template)
        response = {project_id: template.copy() for project_id in project_ids}

        # group results by timestamp, using defaultdict to coalesce into format
        # TODO: use itertools.groupby?
        for row in result:
            update(
                response[row["project_id"]][CATEGORY_NAME_MAP[row["category"]]][row["time"]],
                datamapper(row),
            )
        # add project_ids with no results to dict
        for project_id in project_ids:
            if project_id not in response:
                response[project_id] = template.copy()

        # zerofill response
        response = {
            project_id: {
                category: outcomes.zerofill(list(stats.values()), start, end, rollup, "time")
                for category, stats in timeseries.items()
            }
            for project_id, timeseries in response.items()
        }
        return Response(response)


class OrganizationProjectStatsDetails(ProjectEndpoint):
    def get(self, request, project):
        start, end, rollup = get_date_range_rollup_from_params(request.GET, "1h", round_range=True)

        result = outcomes.query(
            start=start,
            end=end,
            rollup=rollup,
            groupby=["category", "time", "outcome", "reason"],
            aggregations=[["sum", "times_seen", "times_seen"], ["sum", "quantity", "quantity"]],
            filter_keys={"org_id": [project.organization.id], "project_id": [project.id]},
            orderby=["time"],
        )

        # need .copy here?
        response = {
            "statsErrors": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsTransactions": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsAttachments": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
        }
        for row in result:
            if "category" in row:
                uniq_key = row["time"]
                update(response[CATEGORY_NAME_MAP[row["category"]]][uniq_key], datamapper(row))

        response = {
            category: outcomes.zerofill(list(val.values()), start, end, rollup, "time")
            for category, val in response.items()
        }
        return Response(response)


def outcome_to_string(outcome):
    return OUTCOME_TO_STR[outcome]


def rate_limited_reason_mapper(reason):
    if reason in {"usage_exceeded", "grace_period"}:
        reason_val = "overQuota"
    elif reason == "smart_rate_limit":
        reason_val = "spikeProtection"
    else:
        reason_val = "other"
    return reason_val


def datamapper(row):
    obj = {"time": row["time"]}
    if row["outcome"] == Outcome.RATE_LIMITED:
        # TODO: make this actually work
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


def update(d, u):
    for k, v in u.items():
        if isinstance(v, collections.abc.Mapping):
            d[k] = update(d.get(k, {}), v)
        else:
            d[k] = v
    return d
