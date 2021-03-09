from rest_framework.response import Response
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.utils import get_date_range_rollup_from_params
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Project, Team

from sentry.snuba import outcomes
from sentry_relay import DataCategory
from sentry.utils.outcomes import Outcome

from sentry.utils.snuba import (
    naiveify_datetime,
    to_naive_timestamp,
)


CATEGORY_NAME_MAP = {
    DataCategory.ERROR: "statsErrors",
    DataCategory.TRANSACTION: "statsTransactions",
    DataCategory.ATTACHMENT: "statsAttachments",
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

        response = StatsResponse(start, end, rollup)
        for row in result:
            stat_to_update = response.get(row["category"])
            stat_to_update.update(row)

        # response.zerofill(start, end, rollup)
        return Response(response.build_fields())


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

        response = {project_id: StatsResponse(start, end, rollup) for project_id in project_ids}
        for row in result:
            stat_to_update = response[row["project_id"]].get(row["category"])
            stat_to_update.update(row)

        return Response(
            {project_id: stat_res.build_fields() for project_id, stat_res in response.items()}
        )


class OrganizationProjectStatsDetails(ProjectEndpoint, OrganizationEndpoint):
    def get(self, request, project):
        start, end, rollup = get_date_range_rollup_from_params(request.GET, "1h", round_range=True)

        # TODO: see if there's a better way to get the user's projects
        project_list = []
        team_list = Team.objects.get_for_user(organization=project.organization, user=request.user)
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
        response = StatsResponse(start, end, rollup)
        for row in result:
            stat_to_update = response.get(row["category"])
            stat_to_update.update(row)

        return Response(response.build_fields())


# TODO: verify what kind of timestamp we return to frontend
def zerofill(data, start, end, rollup, orderby):
    rv = {}
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
            val = MeasureValue(key)
            rv[key] = val

    return rv


class StatMeasure:
    def __init__(self, quantity=0, times_seen=0):
        self.quantity = quantity
        self.times_seen = times_seen


class StatsResponse:
    def __init__(self, start, end, rollup):
        self.errors = TimeSeriesValues(start, end, rollup)
        self.transactions = TimeSeriesValues(start, end, rollup)
        self.attachments = TimeSeriesValues(start, end, rollup)

    _GETTERS = {
        DataCategory.ERROR: (lambda s: s.errors),
        DataCategory.TRANSACTION: (lambda s: s.transactions),
        DataCategory.ATTACHMENT: (lambda s: s.attachments),
    }

    ALL_FIELDS = frozenset(_GETTERS.keys())

    def get(self, category):
        return self._GETTERS[category](self)

    def __iter__(self):
        yield DataCategory.ERROR, self.errors
        yield DataCategory.TRANSACTION, self.transactions
        yield DataCategory.ATTACHMENT, self.attachments

    def zerofill(self, start, end, rollup):
        self.errors = zerofill(self.errors, start, end, rollup, "time")
        self.transactions = zerofill(self.transactions, start, end, rollup, "time")
        self.attachments = zerofill(self.attachments, start, end, rollup, "time")

    def build_fields(self):
        return {CATEGORY_NAME_MAP[category]: values.serialize() for category, values in self}


class MeasureValue:
    def __init__(self, time):
        self.accepted = StatMeasure(0, 0)
        self.filtered = StatMeasure(0, 0)
        self.over_quota = StatMeasure(0, 0)
        self.spike_protection = StatMeasure(0, 0)
        self.other = StatMeasure(0, 0)
        self.time = time

    def serialize(self):
        return {
            "accepted": {
                "quantity": self.accepted.quantity,
                "times_seen": self.accepted.times_seen,
            },
            "filtered": {"quantity": self.filtered.quantity, "times_seen": self.filtered.quantity},
            "dropped": {
                "overQuota": {
                    "quantity": self.over_quota.quantity,
                    "times_seen": self.over_quota.quantity,
                },
                "spikeProtection": {
                    "quantity": self.spike_protection.quantity,
                    "times_seen": self.spike_protection.quantity,
                },
                "other": {"quantity": self.other.quantity, "times_seen": self.other.quantity},
            },
            "time": self.time,
        }

    def update(self, row):
        if row["outcome"] == Outcome.RATE_LIMITED:
            if row["reason"] in {"usage_exceeded", "grace_period"}:
                self.over_quota.quantity = row["quantity"]
                self.over_quota.times_seen = row["times_seen"]
            elif row["reason"] in "smart_rate_limit":
                self.spike_protection.quantity = row["quantity"]
                self.spike_protection.times_seen = row["quantity"]
            else:
                self.other.quantity = row["quantity"]
                self.other.times_seen = row["quantity"]

        elif row["outcome"] == Outcome.ACCEPTED:
            self.accepted.quantity = row["quantity"]
            self.accepted.times_seen = row["times_seen"]
        elif row["outcome"] == Outcome.FILTERED:
            self.filtered.quantity = row["quantity"]
            self.filtered.times_seen = row["times_seen"]

    def rate_limited_reason_mapper(reason):
        # billing logic ported over. TODO: combine usages of this into some abstracted module?
        if reason in {"usage_exceeded", "grace_period"}:
            reason_val = "overQuota"
        elif reason == "smart_rate_limit":
            reason_val = "spikeProtection"
        else:
            reason_val = "other"
        return reason_val


class TimeSeriesValues:
    def __init__(self, start, end, rollup):
        self.values = zerofill({}, start, end, rollup, "time")

    def update(self, row):
        self.values[row["time"]].update(row)

    def serialize(self):
        return [value.serialize() for value in self.values.values()]
