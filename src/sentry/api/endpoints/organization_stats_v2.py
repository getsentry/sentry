from rest_framework.response import Response
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.utils import get_date_range_rollup_from_params
from sentry.api.bases.project import ProjectEndpoint

from sentry.snuba import outcomes
from sentry.api.serializers.models.organization_stats import StatsResponse


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

        return Response(response.build_fields())


class OrganizationProjectStatsIndex(OrganizationEndpoint):
    def get(self, request, organization):
        start, end, rollup = get_date_range_rollup_from_params(request.GET, "1h", round_range=True)

        projects = self.get_projects(request, organization)
        project_ids = list({p.id for p in projects})

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

        projects = self.get_projects(request, project.organization)
        project_ids = list({p.id for p in projects})

        if project.id not in project_ids:
            # TODO: more info in response here?
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
