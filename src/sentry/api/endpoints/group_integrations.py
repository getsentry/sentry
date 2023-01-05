from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, integrations
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import IntegrationIssueSerializer, serialize
from sentry.integrations import IntegrationFeatures
from sentry.services.hybrid_cloud import ApiPaginationArgs
from sentry.services.hybrid_cloud.integration import integration_service


@region_silo_endpoint
class GroupIntegrationsEndpoint(GroupEndpoint):
    def get(self, request: Request, group) -> Response:
        has_issue_basic = features.has(
            "organizations:integrations-issue-basic", group.organization, actor=request.user
        )

        has_issue_sync = features.has(
            "organizations:integrations-issue-sync", group.organization, actor=request.user
        )

        if not (has_issue_basic or has_issue_sync):
            return self.respond([])

        providers = [
            i.key
            for i in integrations.all()
            if i.has_feature(IntegrationFeatures.ISSUE_BASIC)
            or i.has_feature(IntegrationFeatures.ISSUE_SYNC)
        ]

        result = integration_service.page_integration_ids(
            organization_id=group.organization.id,
            provider_keys=providers,
            args=ApiPaginationArgs.from_endpoint_request(self, request),
        )

        response = Response(
            serialize(
                integration_service.get_integrations(integration_ids=result.ids),
                user=request.user,
                serializer=IntegrationIssueSerializer(group),
            )
        )

        self.add_cursor_headers(request, response, result)
        return response
