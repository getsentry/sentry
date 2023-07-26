import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.api.serializers import serialize
from sentry.api.serializers.models.grouprelease import GroupReleaseWithStatsSerializer
from sentry.models import Group, GroupRelease, ReleaseEnvironment, ReleaseProject
from sentry.models.environment import Environment
from sentry.snuba import metrics_enhanced_performance
from sentry.snuba.referrer import Referrer

FEATURE = "organizations:starfish-test-endpoint"


@region_silo_endpoint
class OrganizationEventsStarfishEndpoint(OrganizationEventsV2EndpointBase):
    """
    This is a test endpoint that's meant to only be used for starfish testing
    purposes.
    """

    def get(self, request: Request, organization) -> Response:
        if not features.has(FEATURE, organization, actor=request.user):
            return Response(status=404)

        try:
            # a really slow db query
            projects = self.get_projects(request, organization)
            project_ids = [p.id for p in projects]
            group = Group.objects.filter(project_id__in=project_ids).last()

            environments = Environment.objects.filter(organization_id=organization.id)

            release_projects = ReleaseProject.objects.filter(
                project_id=group.project_id
            ).values_list("release_id", flat=True)

            release_envs = ReleaseEnvironment.objects.filter(
                release_id__in=release_projects,
                organization_id=group.project.organization_id,
            )
            if environments:
                release_envs = release_envs.filter(
                    environment_id__in=[env.id for env in environments]
                )
            release_envs = release_envs.order_by("first_seen").values_list("release_id", flat=True)

            group_releases = GroupRelease.objects.filter(
                group_id=group.id,
                release_id__in=release_envs[:1],
            )
            if group_releases:
                serialize(group_releases[0], request.user, GroupReleaseWithStatsSerializer())

            try:
                snuba_params, params = self.get_snuba_dataclass(request, organization)
            except NoProjects:
                return Response([])

            with sentry_sdk.start_span(op="starfish.endpoint", description="starfish_test_query"):
                referrer = Referrer.API_DISCOVER_QUERY_TABLE.value
                metrics_enhanced_performance.query(
                    selected_columns=["title", "count()"],
                    query="event.type:transaction",
                    params=params,
                    snuba_params=snuba_params,
                    limit=10000,
                    referrer=referrer,
                )

                # metrics_enhanced_performance.query(
                #     selected_columns=["title", "count_if(mechanism,equals,ANR)"],
                #     query="event.type:transaction",
                #     params=params,
                #     snuba_params=snuba_params,
                #     limit=10000,
                #     referrer=referrer,
                # )
        except Exception:
            return Response(status=200)

        return Response(status=200)
