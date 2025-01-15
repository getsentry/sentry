from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.endpoints.organization_events_stats import OrganizationEventsStatsEndpoint
from sentry.apidocs.constants import RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.models.organization import Organization


@region_silo_endpoint
class SharedWidgetDetailsEndpoint(Endpoint):
    owner = ApiOwner.PERFORMANCE
    authentication_classes = []
    permission_classes = (AllowAny,)

    @extend_schema(
        operation_id="Retrieve an Organization's Custom Dashboard",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(name="share_id", type=str),
        ],
        responses={
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization_id_or_slug: int | str | None = None,
        share_id: str | None = None,
        widget_id: str | None = None,
    ) -> Response:
        """
        Retrieve events data for a singular widget with widget_id
        """
        try:
            # Fetch the organization
            organization = Organization.objects.get(
                id=1,
            )

            class MockAccess:
                def __init__(self, organization):
                    self.organization = organization
                    self.scopes = ["org:read"]

                def has_permission(self, permission):
                    return True

                def has_project_access(self, project):
                    return True

                def has_team_access(self, team):
                    return True

                def has_scope(self, scope):
                    return True

            request.access = MockAccess(organization)

            request.GET = request.GET.copy()
            request.GET.setlist("field", ["issue", "title", "count_unique(user)"])
            request.GET.update(
                {
                    "name": "",
                    "onDemandType": "dynamic_query",
                    "per_page": "20",
                    "project": "1",
                    "query": "",
                    "referrer": "api.dashboards.tablewidget",
                    "sort": "-count_unique(user)",
                    "statsPeriod": "14d",
                    "useOnDemandMetrics": "false",
                    "yAxis": "count_unique(user)",
                }
            )

            # Create an instance of OrganizationEventsStatsEndpoint
            events_stats_endpoint = OrganizationEventsStatsEndpoint()

            # Call the get method
            stats_response = events_stats_endpoint.get(
                request=request,
                organization=organization,
            )
            return stats_response

        except Organization.DoesNotExist:
            return Response({"detail": "Organization not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

        return self.respond({"sample:": "test"})
