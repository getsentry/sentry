from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import (
    ApiKeyAuthentication,
    DSNAuthentication,
    OrgAuthTokenAuthentication,
    TokenAuthentication,
)
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.constants import ObjectStatus
from sentry.feedback.models import Feedback
from sentry.feedback.serializers import FeedbackSerializer
from sentry.models import Organization, ProjectKey
from sentry.models.project import Project
from sentry.utils.sdk import bind_organization_context, configure_scope


class OrganizationFeedbackIndexPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
    }


@region_silo_endpoint
class OrganizationFeedbackIndexEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FEEDBACK

    # Authentication code borrowed from the monitor endpoints (which will eventually be removed)
    authentication_classes = (
        DSNAuthentication,
        TokenAuthentication,
        OrgAuthTokenAuthentication,
        ApiKeyAuthentication,
    )

    permission_classes = (OrganizationFeedbackIndexPermission,)

    def convert_args(
        self,
        request: Request,
        organization_slug: str | None = None,
        *args,
        **kwargs,
    ):
        using_dsn_auth = isinstance(request.auth, ProjectKey)

        # When using DSN auth we're able to infer the organization slug
        if not organization_slug and using_dsn_auth:
            organization_slug = request.auth.project.organization.slug  # type: ignore

        if organization_slug:
            try:
                organization = Organization.objects.get_from_cache(slug=organization_slug)
                # Try lookup by slug first. This requires organization context since
                # slugs are unique only to the organization
            except (Organization.DoesNotExist):
                raise ResourceDoesNotExist

        project = request.auth.project  # type: ignore

        if project.status != ObjectStatus.ACTIVE:
            raise ResourceDoesNotExist

        if using_dsn_auth and project.id != request.auth.project_id:  # type: ignore
            raise ResourceDoesNotExist

        if organization_slug and project.organization.slug != organization_slug:
            raise ResourceDoesNotExist

        # Check project permission. Required for Token style authentication
        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization  # type: ignore

        kwargs["organization"] = organization
        kwargs["project"] = project
        return args, kwargs

    def get(self, request: Request, organization: Organization, project: Project) -> Response:
        if not features.has(
            "organizations:user-feedback-ingest", project.organization, actor=request.user
        ):
            return Response(status=404)

        feedback_list = Feedback.objects.filter(project_id=project.id)
        return self.paginate(
            request=request,
            queryset=feedback_list,
            on_results=lambda x: serialize(x, request.user, FeedbackSerializer()),
            paginator_cls=OffsetPaginator,
        )
