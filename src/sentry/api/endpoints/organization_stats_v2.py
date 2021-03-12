from rest_framework.response import Response
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.snuba import outcomes
from sentry.api.serializers.models.organization_stats import StatsResponse


class OrganizationStatsEndpointV2(OrganizationEndpoint):
    def get(self, request, organization):

        result = outcomes.query(
            groupby=["category", "time", "outcome", "reason"],
            aggregations=[["sum", "quantity", "quantity"]],
            filter_keys={"org_id": [organization.id]},
            orderby=["time"],
            request=request.GET,
        )

        response = StatsResponse()
        for row in result:
            if "category" in row:
                stat_to_update = response.get(row["category"])
                stat_to_update.update(row)
            else:
                # if its a zerofill row, make sure all statcategories have it
                for _, category_stat in response:
                    category_stat.update(row)
        return Response(response.build_fields())


class OrganizationProjectStatsIndex(OrganizationEndpoint):
    def get(self, request, organization):

        projects = self.get_projects(request, organization)
        project_ids = list({p.id for p in projects})

        result = outcomes.query(
            groupby=["project_id", "category", "time", "outcome", "reason"],
            aggregations=[["sum", "quantity", "quantity"]],
            filter_keys={"org_id": [organization.id], "project_id": project_ids},
            orderby=["quantity", "time"],
            request=request.GET,
        )
        response = {project_id: StatsResponse() for project_id in project_ids}
        for project_id, rows in result.items():
            for row in rows:
                if "category" in row:
                    stat_to_update = response[project_id].get(row["category"])
                    stat_to_update.update(row)
                else:
                    # make sure all categories have zerofilled
                    for _, category_stat in response[project_id]:
                        category_stat.update(row)

        return Response(
            {project_id: stat_res.build_fields() for project_id, stat_res in response.items()}
        )
