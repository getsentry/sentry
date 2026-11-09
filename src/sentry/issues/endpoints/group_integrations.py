from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Annotated, Any, TypedDict, cast

from django.contrib.auth.models import AnonymousUser
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import DEFAULT_DURATION_BUDGET, cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.serializers import Serializer, serialize
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.hybridcloud.rpc.pagination import RpcPaginationArgs
from sentry.integrations.api.serializers.models.integration import (
    IntegrationSerializer,
    IntegrationSerializerResponse,
)
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.manager import default_manager as integrations
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.cursors import CursorResult


class LinkedExternalIssueResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the link between the issue and the external issue")]
    key: Annotated[
        str, ApiDescription("Key of the external issue in the provider, such as PROJ-123")
    ]
    url: Annotated[str, ApiDescription("URL of the external issue")]
    title: Annotated[str | None, ApiDescription("Title of the external issue")]
    description: Annotated[str | None, ApiDescription("Description of the external issue")]
    displayName: Annotated[
        str,
        ApiDescription(
            "Name to show for the external issue, such as owner/repo#1. Empty when the integration doesn't set one"
        ),
    ]


class IntegrationIssueSerializerResponse(IntegrationSerializerResponse):
    externalIssues: Annotated[
        list[LinkedExternalIssueResponse],
        ApiDescription("External issues of this integration linked to the issue"),
    ]


class IntegrationIssueSerializer(Serializer[IntegrationIssueSerializerResponse]):
    def __init__(self, group: Group) -> None:
        self.group = group

    def get_attrs(
        self,
        item_list: Sequence[RpcIntegration],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[RpcIntegration, MutableMapping[str, Any]]:
        external_issues = ExternalIssue.objects.filter(
            id__in=GroupLink.objects.get_group_issues(self.group).values_list(
                "linked_id", flat=True
            ),
            integration_id__in=[i.id for i in item_list],
        )

        integrations_by_id = {i.id: i for i in item_list}
        issues_by_integration = defaultdict(list)
        for ei in external_issues:
            # TODO(jess): move into an external issue serializer?
            integration = integrations_by_id[ei.integration_id]
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
        self,
        obj: Integration | RpcIntegration,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> IntegrationIssueSerializerResponse:
        base = IntegrationSerializer().serialize(obj, attrs, user)
        return {**base, "externalIssues": attrs.get("external_issues", [])}


@extend_schema(tags=["Integration"])
@cell_silo_endpoint
class GroupIntegrationsEndpoint(GroupEndpoint):
    max_acceptable_duration = DEFAULT_DURATION_BUDGET

    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
    }

    @extend_schema(
        operation_id="listOrganizationIssueIntegrations",
        summary="List an Issue's Tracker Integrations and Links",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            CursorQueryParam,
            OpenApiParameter(
                "per_page",
                type=int,
                description="The maximum number of integrations to return per page (1–100).",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "IssueIntegrationsResponse", list[IntegrationIssueSerializerResponse]
            ),
        },
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-integrations",
        url_names=["sentry-api-0-group-integrations"],
    )
    def get(
        self, request: Request, group: Group
    ) -> Response[list[IntegrationIssueSerializerResponse]]:
        """
        List the organization's issue-tracker integrations and the external issues
        linked to this Sentry issue through each integration. The external issue's
        `id` is the Sentry link identifier used by the unlink endpoint.
        """
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

        self.add_cursor_headers(
            request,
            response,
            cast("CursorResult[Any]", result),
        )
        return response
