from __future__ import absolute_import

from sentry import features

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ObjectStatus, OrganizationIntegration
from sentry.integrations.slack.utils import get_integration_type
from sentry.utils.compat import filter


class OrganizationIntegrationsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request, organization):
        integrations = OrganizationIntegration.objects.filter(
            organization=organization, status=ObjectStatus.VISIBLE
        )

        if "provider_key" in request.GET:
            integrations = integrations.filter(integration__provider=request.GET["provider_key"])

        # XXX(meredith): Filter out workspace apps if there are any.
        if not features.has(
            "organizations:slack-allow-workspace", organization=organization, actor=request.user
        ):
            slack_integrations = integrations.filter(integration__provider="slack")
            workspace_ids = [
                workspace_app.id
                for workspace_app in filter(
                    lambda i: get_integration_type(i.integration) == "workspace_app",
                    slack_integrations,
                )
            ]
            integrations = integrations.exclude(id__in=workspace_ids)

        # include the configurations by default if no param
        include_config = True
        if request.GET.get("includeConfig") == "0":
            include_config = False

        return self.paginate(
            queryset=integrations,
            request=request,
            order_by="integration__name",
            on_results=lambda x: serialize(x, request.user, include_config=include_config),
            paginator_cls=OffsetPaginator,
        )
