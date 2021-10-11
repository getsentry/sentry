from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models import Integration, Repository
from sentry.plugins.base import bindings
from sentry.utils.sdk import capture_exception


class OrganizationRepositoriesEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request, organization):
        """
        List an Organization's Repositories
        ```````````````````````````````````

        Return a list of version control repositories for a given organization.

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        queryset = Repository.objects.filter(organization_id=organization.id)

        if not features.has("organizations:integrations-ignore-vsts-deprecation", organization):
            queryset = queryset.exclude(provider="visualstudio")

        status = request.GET.get("status", "active")
        if status == "active":
            queryset = queryset.filter(status=ObjectStatus.VISIBLE)
        elif status == "deleted":
            queryset = queryset.exclude(status=ObjectStatus.VISIBLE)
        # TODO(mn): Remove once old Plugins are removed or everyone migrates to
        # the new Integrations. Hopefully someday?
        elif status == "unmigratable":
            integrations = Integration.objects.filter(
                organizationintegration__organization=organization,
                organizationintegration__status=ObjectStatus.ACTIVE,
                provider__in=("bitbucket", "github", "vsts"),
                status=ObjectStatus.ACTIVE,
            )

            repos = []

            for i in integrations:
                try:
                    repos.extend(
                        i.get_installation(organization.id).get_unmigratable_repositories()
                    )
                except Exception:
                    capture_exception()
                    # Don't rely on the Integration's API being available. If
                    # it's not, the page should still render.
                    continue

            return Response(serialize(repos, request.user))

        elif status:
            queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request, organization):
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
