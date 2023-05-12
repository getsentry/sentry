from __future__ import annotations

from collections import defaultdict
from typing import Any, List, Mapping, MutableMapping

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, integrations
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import IntegrationSerializer, serialize
from sentry.integrations import IntegrationFeatures
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.models.user import User
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service
from sentry.services.hybrid_cloud.pagination import RpcPaginationArgs
from sentry.utils.json import JSONData


class IntegrationIssueSerializer(IntegrationSerializer):
    def __init__(self, group: Group) -> None:
        self.group = group

    def get_attrs(
        self, item_list: List[RpcIntegration], user: User, **kwargs: Any
    ) -> MutableMapping[RpcIntegration, MutableMapping[str, Any]]:
        external_issues = ExternalIssue.objects.filter(
            id__in=GroupLink.objects.get_group_issues(self.group).values_list(
                "linked_id", flat=True
            ),
            integration_id__in=[i.id for i in item_list],
        )

        issues_by_integration = defaultdict(list)
        for ei in external_issues:
            # TODO(jess): move into an external issue serializer?
            integration = integration_service.get_integration(integration_id=ei.integration_id)
            if integration is None:
                continue
            installation = integration_service.get_installation(
                integration=integration, organization_id=self.group.organization.id
            )
            if hasattr(installation, "get_issue_url") and hasattr(
                installation, "get_issue_display_name"
            ):
                issues_by_integration[ei.integration_id].append(
                    {
                        "id": str(ei.id),
                        "key": ei.key,
                        "url": installation.get_issue_url(ei.key),  # type: ignore
                        "title": ei.title,
                        "description": ei.description,
                        "displayName": installation.get_issue_display_name(ei),  # type: ignore
                    }
                )

        return {
            item: {"external_issues": issues_by_integration.get(item.id, [])} for item in item_list
        }

    def serialize(
        self, obj: RpcIntegration, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> MutableMapping[str, JSONData]:
        data = super().serialize(obj, attrs, user)
        data["externalIssues"] = attrs.get("external_issues", [])
        return data


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
            args=RpcPaginationArgs.from_endpoint_request(self, request),
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
