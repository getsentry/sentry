from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationIntegrationsLoosePermission,
)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models.repository import Repository
from sentry.plugins.base import bindings
from sentry.ratelimits.config import SENTRY_RATELIMITER_GROUP_DEFAULTS, RateLimitConfig
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.utils.sdk import capture_exception

UNMIGRATABLE_PROVIDERS = ("bitbucket", "github")


@region_silo_endpoint
class OrganizationRepositoriesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (OrganizationIntegrationsLoosePermission,)
    rate_limits = RateLimitConfig(
        group="CLI", limit_overrides={"POST": SENTRY_RATELIMITER_GROUP_DEFAULTS["default"]}
    )

    def get(self, request: Request, organization) -> Response:
        """
        List an Organization's Repositories
        ```````````````````````````````````

        Return a list of version control repositories for a given organization.

        :pparam string organization_slug: the organization short name
        :qparam string query: optional filter by repository name
        :auth: required
        """
        queryset = Repository.objects.filter(organization_id=organization.id)

        integration_id = request.GET.get("integration_id", None)
        if integration_id:
            queryset = queryset.filter(integration_id=integration_id)

        status = request.GET.get("status", "active")
        query = request.GET.get("query")
        if query:
            queryset = queryset.filter(Q(name__icontains=query))
        if status == "active":
            queryset = queryset.filter(status=ObjectStatus.ACTIVE)
        elif status == "deleted":
            queryset = queryset.exclude(status=ObjectStatus.ACTIVE)
        # TODO(mn): Remove once old Plugins are removed or everyone migrates to
        # the new Integrations. Hopefully someday?
        elif status == "unmigratable":
            integrations = integration_service.get_integrations(
                status=ObjectStatus.ACTIVE,
                providers=UNMIGRATABLE_PROVIDERS,
                organization_id=organization.id,
                org_integration_status=ObjectStatus.ACTIVE,
                limit=None,
            )

            repos = []

            for i in integrations:
                try:
                    installation = i.get_installation(organization_id=organization.id)
                    repos.extend(installation.get_unmigratable_repositories())
                except Exception:
                    capture_exception()
                    # Don't rely on the Integration's API being available. If
                    # it's not, the page should still render.
                    continue

            return Response(serialize(repos, request.user))

        elif status:
            queryset = queryset.none()
        elif status is None:
            queryset = queryset.exclude(status=ObjectStatus.HIDDEN)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization) -> Response:
        if not request.user.is_authenticated:
            return Response(status=401)
        provider_id = request.data.get("provider")

        if provider_id is not None and provider_id.startswith("integrations:"):
            try:
                provider_cls = bindings.get("integration-repository.provider").get(provider_id)
            except KeyError:
                return Response({"error_type": "validation"}, status=400)
            provider = provider_cls(id=provider_id)
            return provider.dispatch(request, organization)

        try:
            provider_cls = bindings.get("repository.provider").get(provider_id)
        except KeyError:
            return Response({"error_type": "validation"}, status=400)

        provider = provider_cls(id=provider_id)
        return provider.dispatch(request, organization)
