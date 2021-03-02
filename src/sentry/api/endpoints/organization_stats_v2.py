from rest_framework.response import Response
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.utils import get_date_range_rollup_from_params
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Project, Team

from sentry.snuba import outcomes
from sentry_relay import DataCategory
from sentry.utils.outcomes import Outcome
from collections import defaultdict

OUTCOME_TO_STR = {
    Outcome.ACCEPTED: "accepted",
    Outcome.FILTERED: "filtered",
    Outcome.RATE_LIMITED: "spike_protection?",
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


def outcome_to_string(outcome):
    return OUTCOME_TO_STR[outcome]


def datamapper(row):
    obj = {"time": row["time"]}
    if row["outcome"] == Outcome.RATE_LIMITED:
        # TODO: make this actually work
        obj[outcome_to_string(row["outcome"])] = {
            row["reason"]: {
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


class OrganizationStatsEndpointV2(OrganizationEndpoint):
    def get(self, request, organization):
        # group = request.GET.get("group", "organization")
        # if group == "organization":
        #     keys = [organization.id]
        # team_list = Team.objects.get_for_user(organization=organization, user=request.user)

        # do we always want all of the projects in an org? is there any case where we wouldnt?
        # project_list = []
        # for team in team_list:
        #     project_list.extend(Project.objects.get_for_user(team=team, user=request.user))

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
        # need .copy here?
        new_res = {
            "statsErrors": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsTransactions": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsAttachments": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
        }
        for row in result:
            if "category" in row:
                uniq_key = row["time"]
                new_res[CATEGORY_NAME_MAP[row["category"]]][uniq_key].update(datamapper(row))

        new_res = {
            category: outcomes.zerofill(list(val.values()), start, end, rollup, "time")
            for category, val in new_res.items()
        }
        return Response(new_res)


class OrganizationProjectStatsIndex(OrganizationEndpoint):
    def get(self, request, organization):
        # group = request.GET.get("group", "organization")
        # if group == "organization":
        #     keys = [organization.id]
        # team_list = Team.objects.get_for_user(organization=organization, user=request.user)

        # do we always want all of the projects in an org? is there any case where we wouldnt?
        # project_list = []
        # for team in team_list:
        #     project_list.extend(Project.objects.get_for_user(team=team, user=request.user))
        # make sure this only has projects user has access to
        start, end, rollup = get_date_range_rollup_from_params(request.GET, "1h", round_range=True)

        project_list = []
        team_list = Team.objects.get_for_user(organization=organization, user=request.user)
        for team in team_list:
            project_list.extend(Project.objects.get_for_user(team=team, user=request.user))

        result = outcomes.query(
            start=start,
            end=end,
            rollup=rollup,
            groupby=["project_id", "category", "time", "outcome", "reason"],
            aggregations=[["sum", "times_seen", "times_seen"], ["sum", "quantity", "quantity"]],
            filter_keys={"org_id": [organization.id]},
            orderby=["times_seen", "time"],
        )
        # TODO: filter out projects user doesnt have access to.
        # need .copy here?
        # TODO: zerofill projects
        template = {
            "statsErrors": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsTransactions": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsAttachments": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
        }
        new_res = {}
        for row in result:
            if "category" in row:
                uniq_key = "-".join([str(row["time"]), str(row["project_id"])])
                if row["project_id"] in new_res:
                    new_res[row["project_id"]][CATEGORY_NAME_MAP[row["category"]]][uniq_key].update(
                        datamapper(row)
                    )
                else:
                    new_res[row["project_id"]] = template.copy()
                    new_res[row["project_id"]][CATEGORY_NAME_MAP[row["category"]]][uniq_key].update(
                        datamapper(row)
                    )

        new_res = {
            project_id: {
                category: outcomes.zerofill(list(val.values()), start, end, rollup, "time")
                for category, val in val2.items()
            }
            for project_id, val2 in new_res.items()
        }
        # new_res = {
        #     category: outcomes.zerofill(list(val.values()), start, end, rollup, "time")
        #     for category, val in new_res.items()
        # }
        return Response(new_res)


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
        new_res = {
            "statsErrors": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsTransactions": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
            "statsAttachments": defaultdict(lambda: dict(DEFAULT_TS_VAL)),
        }
        for row in result:
            if "category" in row:
                uniq_key = row["time"]
                new_res[CATEGORY_NAME_MAP[row["category"]]][uniq_key].update(datamapper(row))

        new_res = {
            category: outcomes.zerofill(list(val.values()), start, end, rollup, "time")
            for category, val in new_res.items()
        }
        return Response(new_res)
