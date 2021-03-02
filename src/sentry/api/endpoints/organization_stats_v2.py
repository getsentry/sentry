from rest_framework.response import Response
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.utils import get_date_range_rollup_from_params
from sentry.api.bases.project import ProjectEndpoint

from sentry.snuba import outcomes
from sentry_relay import DataCategory
from sentry.utils.outcomes import Outcome
from collections import defaultdict

OUTCOME_TO_STR = {
    Outcome.ACCEPTED: "accepted",
    Outcome.FILTERED: "filtered",
    Outcome.RATE_LIMITED: "spike_protection?",
}


def outcome_to_string(outcome):
    return OUTCOME_TO_STR[outcome]


class OrganizationStatsEndpointV2(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Retrieve Event Counts for an Organization
        `````````````````````````````````````````

        .. caution::
           This endpoint may change in the future without notice.

        Return a set of points representing a normalized timestamp and the
        number of events seen in the period.

        :pparam string organization_slug: the slug of the organization for
                                          which the stats should be
                                          retrieved.
        :qparam timestamp start: a timestamp to set the start of the query
                                 in seconds since UNIX epoch.
        :qparam timestamp end: a timestamp to set the end of the query
                                 in seconds since UNIX epoch.
        :qparam string rollup: an explicit resolution to search
                                 for (one of ``1hr``, or ``1day``)
        :auth: required
        """
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

        default_vals = [
            ("accepted", {"quantity": 0, "times_seen": 0}),
            ("filtered", {"quantity": 0, "times_seen": 0}),
            (
                "dropped",
                {
                    "overQuota": dict([("quantity", 0), ("times_seen", 0)]),
                    "spikeProtection": dict([("quantity", 0), ("times_seen", 0)]),
                    "other": dict([("quantity", 0), ("times_seen", 0)]),
                },
            ),
        ]
        new_res = {
            "statsErrors": defaultdict(lambda: defaultdict(dict, default_vals)),
            "statsTransactions": defaultdict(lambda: defaultdict(dict, default_vals)),
            "statsAttachments": defaultdict(lambda: defaultdict(dict, default_vals)),
        }
        for row in result:
            # uniq_key = "-".join(outcome_to_string(row["outcome"]))
            uniq_key = row["time"]
            if row["category"] == DataCategory.ERROR:
                new_res["statsErrors"][uniq_key].update({"time": row["time"]})
                if row["outcome"] == Outcome.RATE_LIMITED:
                    new_res["statsErrors"][uniq_key][outcome_to_string(row["outcome"])].update(
                        {
                            row["reason"]: {
                                "quantity": row["quantity"],
                                "times_seen": row["times_seen"],
                            }
                        }
                    )
                else:
                    new_res["statsErrors"][uniq_key].update(
                        {
                            outcome_to_string(row["outcome"]): {
                                "quantity": row["quantity"],
                                "times_seen": row["times_seen"],
                            }
                        }
                    )
            elif row["category"] == DataCategory.TRANSACTION:
                new_res["statsTransactions"][uniq_key].update({"time": row["time"]})
                new_res["statsTransactions"][uniq_key].update(
                    {
                        outcome_to_string(row["outcome"]): {
                            "quantity": row["quantity"],
                            "times_seen": row["times_seen"],
                        }
                    }
                )
            elif row["category"] == DataCategory.ATTACHMENT:
                new_res["statsAttachments"][uniq_key].update({"time": row["time"]})
                new_res["statsAttachments"][uniq_key].update(
                    {
                        outcome_to_string(row["outcome"]): {
                            "quantity": row["quantity"],
                            "times_seen": row["times_seen"],
                        }
                    }
                )
        # print(new_res)
        new_res = {category: list(val.values()) for category, val in new_res.items()}

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

        result = outcomes.query(
            start=start,
            end=end,
            rollup=rollup,
            groupby=["project_id", "category", "time", "outcome", "reason"],
            aggregations=[["sum", "times_seen", "times_seen"], ["sum", "quantity", "quantity"]],
            filter_keys={"org_id": [organization.id]},
            orderby=["times_seen", "time"],
        )

        new_res = {"statsErrors": [], "statsTransactions": [], "statsAttachments": []}
        for row in result:
            # uniq_key =
            if row["category"] == DataCategory.ERROR:
                new_res["statsErrors"].append(row)
            elif row["category"] == DataCategory.TRANSACTION:
                new_res["statsTransactions"].append(row)
            elif row["category"] == DataCategory.ATTACHMENT:
                new_res["statsAttachments"].append(row)

        #
        #
        # add logic for grouping datacategories as errors here
        # result = group_timestamps(result["data"], groupby)
        # if "project_id" in groupby:
        #     result = group_by_project(result)
        #     result = {
        #         project_id: zerofill(vals, start, end, rollup, "time")
        #         for project_id, vals in result.items()
        #     }
        # else:
        #     result = zerofill(result, start, end, rollup, "time")

        return Response(result)


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
            orderby=["-timestamp"],
        )

        return Response(result)
