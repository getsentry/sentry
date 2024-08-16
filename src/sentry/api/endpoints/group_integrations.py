from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, MutableMapping
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.hybridcloud.rpc.pagination import RpcPaginationArgs
from sentry.integrations.api.serializers.models.integration import IntegrationSerializer
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.manager import default_manager as integrations
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.users.models.user import User


class IntegrationIssueSerializer(IntegrationSerializer):
    def __init__(self, group: Group) -> None:
        self.group = group

    def get_attrs(
        self, item_list: list[RpcIntegration], user: User, **kwargs: Any
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
            installation = integration.get_installation(organization_id=self.group.organization.id)
            if hasattr(installation, "get_issue_url") and hasattr(
                installation, "get_issue_display_name"
            ):
                issues_by_integration[ei.integration_id].append(
                    {
                        "id": str(ei.id),
                        "key": ei.key,
                        "url": installation.get_issue_url(ei.key),
                        "title": ei.title,
                        "description": ei.description,
                        "displayName": installation.get_issue_display_name(ei),
                    }
                )

        return {
            item: {"external_issues": issues_by_integration.get(item.id, [])} for item in item_list
        }

    def serialize(
        self, obj: RpcIntegration, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> MutableMapping[str, Any]:
        data = super().serialize(obj, attrs, user)
        data["externalIssues"] = attrs.get("external_issues", [])
        return data


@region_silo_endpoint
class GroupIntegrationsEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

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
