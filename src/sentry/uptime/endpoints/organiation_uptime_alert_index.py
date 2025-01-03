from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.helpers.teams import get_teams
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, UptimeParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.db.models.query import in_iexact
from sentry.models.organization import Organization
from sentry.search.utils import tokenize_query
from sentry.types.actor import Actor
from sentry.uptime.endpoints.serializers import (
    ProjectUptimeSubscriptionSerializer,
    ProjectUptimeSubscriptionSerializerResponse,
)
from sentry.uptime.models import ProjectUptimeSubscription


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationUptimeAlertIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS
    permission_classes = (OrganizationPermission,)

    @extend_schema(
        operation_id="Retrieve Uptime Alets for an Organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            UptimeParams.OWNER,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "UptimeAlertList", list[ProjectUptimeSubscriptionSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Lists uptime alerts. May be filtered to a project or environment.
        """
        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return self.respond([])

        queryset = ProjectUptimeSubscription.objects.filter(
            project__organization_id=organization.id, project_id__in=filter_params["project_id"]
        )
        query = request.GET.get("query")
        owners = request.GET.getlist("owner")

        if "environment" in filter_params:
            queryset = queryset.filter(environment__in=filter_params["environment_objects"])

        if owners:
            owners_set = set(owners)

            # Remove special values from owners, this can't be parsed as an Actor
            include_myteams = "myteams" in owners_set
            owners_set.discard("myteams")
            include_unassigned = "unassigned" in owners_set
            owners_set.discard("unassigned")

            actors = [Actor.from_identifier(identifier) for identifier in owners_set]

            user_ids = [actor.id for actor in actors if actor.is_user]
            team_ids = [actor.id for actor in actors if actor.is_team]

            teams = get_teams(
                request,
                organization,
                teams=[*team_ids, *(["myteams"] if include_myteams else [])],
            )
            team_ids = [team.id for team in teams]

            owner_filter = Q(owner_user_id__in=user_ids) | Q(owner_team_id__in=team_ids)

            if include_unassigned:
                unassigned_filter = Q(owner_user_id=None) & Q(owner_team_id=None)
                queryset = queryset.filter(unassigned_filter | owner_filter)
            else:
                queryset = queryset.filter(owner_filter)

        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "query":
                    query_value = " ".join(value)
                    queryset = queryset.filter(
                        Q(name__icontains=query_value)
                        | Q(uptime_subscription__url__icontains=query_value)
                    )
                elif key == "name":
                    queryset = queryset.filter(in_iexact("name", value))
                else:
                    queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user, ProjectUptimeSubscriptionSerializer()),
            paginator_cls=OffsetPaginator,
        )
