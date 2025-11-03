from __future__ import annotations

from collections.abc import Mapping, MutableMapping
from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    inline_serializer,
)
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.integrations.api.serializers.models.integration import IntegrationSerializer
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
)
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.shared_integrations.exceptions import (
    IntegrationConfigurationError,
    IntegrationError,
    IntegrationFormError,
    IntegrationProviderError,
)
from sentry.signals import integration_issue_created, integration_issue_linked
from sentry.types.activity import ActivityType
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

MISSING_FEATURE_MESSAGE = "Your organization does not have access to this feature."


# Custom parameters for this endpoint
ACTION_PARAM = OpenApiParameter(
    name="action",
    location="query",
    required=True,
    type=str,
    enum=["link", "create"],
    description='The action to perform. Must be either "link" to link an existing external issue or "create" to create and link a new external issue.',
)

EXTERNAL_ISSUE_QUERY_PARAM = OpenApiParameter(
    name="externalIssue",
    location="query",
    required=True,
    type=int,
    description="The ID of the external issue (ExternalIssue.id) to unlink from the group.",
)


class IntegrationIssueConfigSerializer(IntegrationSerializer):
    def __init__(
        self,
        group: Group,
        action: str,
        config: Mapping[str, Any],
    ) -> None:
        self.group = group
        self.action = action
        self.config = config

    def serialize(
        self,
        obj: Integration | RpcIntegration,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[str, Any]:
        data = super().serialize(obj, attrs, user)

        if self.action == "link":
            data["linkIssueConfig"] = self.config
        if self.action == "create":
            data["createIssueConfig"] = self.config

        return data


# Request serializers for documentation
class GroupIntegrationLinkIssueSerializer(serializers.Serializer):
    externalIssue = serializers.CharField(
        required=True,
        help_text="The external issue identifier from the integration provider (e.g., Jira issue key, GitHub issue number).",
    )


# Response serializer for POST and PUT endpoints
class ExternalIssueLinkResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField(help_text="The ID of the external issue in Sentry.")
    key = serializers.CharField(help_text="The external issue key or identifier.")
    url = serializers.URLField(help_text="The URL to view the external issue.")
    integrationId = serializers.IntegerField(
        help_text="The ID of the integration this issue belongs to."
    )
    displayName = serializers.CharField(help_text="The display name of the external issue.")


# Response serializer for GET endpoint - documents the integration config response
class IntegrationConfigResponseSerializer(serializers.Serializer):
    id = serializers.CharField(help_text="The ID of the integration.")
    name = serializers.CharField(help_text="The name of the integration.")
    icon = serializers.CharField(
        required=False, allow_null=True, help_text="The URL to the integration's icon."
    )
    domainName = serializers.CharField(
        required=False, allow_null=True, help_text="The domain name for the integration."
    )
    accountType = serializers.CharField(
        required=False, allow_null=True, help_text="The type of account for the integration."
    )
    scopes = serializers.ListField(
        child=serializers.CharField(), help_text="The list of scopes for the integration."
    )
    status = serializers.CharField(help_text="The status of the integration.")
    provider = serializers.DictField(help_text="Information about the integration provider.")
    linkIssueConfig = serializers.ListField(
        required=False,
        help_text="Configuration for linking an existing issue (only present when action=link).",
    )
    createIssueConfig = serializers.ListField(
        required=False,
        help_text="Configuration for creating a new issue (only present when action=create).",
    )


@region_silo_endpoint
@extend_schema(tags=["Integrations"])
class GroupIntegrationDetailsEndpoint(GroupEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
        "DELETE": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Get Integration Configuration for Linking or Creating an Issue",
        parameters=[
            IssueParams.ISSUES_OR_GROUPS,
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUE_ID,
            GlobalParams.INTEGRATION_ID,
            ACTION_PARAM,
        ],
        responses={
            200: IntegrationConfigResponseSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, group, integration_id) -> Response:
        """
        Retrieves the config needed to either link or create an external issue for a group.
        """
        if not request.user.is_authenticated:
            return Response(status=400)
        elif not self._has_issue_feature(group.organization, request.user):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=400)

        # Keep link/create separate since create will likely require
        # many external API calls that aren't necessary if the user is
        # just linking
        action = request.GET.get("action")
        if action not in {"link", "create"}:
            return Response({"detail": "Action is required and should be either link or create"})

        organization_id = group.project.organization_id
        result = integration_service.organization_context(
            organization_id=organization_id, integration_id=integration_id
        )
        integration = result.integration
        org_integration = result.organization_integration
        if not integration or not org_integration:
            return Response(status=404)

        if not self._has_issue_feature_on_integration(integration):
            return Response(
                {"detail": "This feature is not supported for this integration."}, status=400
            )

        installation = self._get_installation(integration, organization_id)
        try:
            if action == "link":
                config = installation.get_link_issue_config(group, params=request.GET)
            elif action == "create":
                config = installation.get_create_issue_config(
                    group, request.user, params=request.GET
                )
            else:
                raise AssertionError("unreachable")
        except IntegrationError as e:
            return Response({"detail": str(e)}, status=400)

        return Response(
            serialize(
                integration,
                request.user,
                IntegrationIssueConfigSerializer(group, action, config),
                organization_id=organization_id,
            )
        )

    @extend_schema(
        operation_id="Create and Link an External Issue to an Issue",
        parameters=[
            IssueParams.ISSUES_OR_GROUPS,
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUE_ID,
            GlobalParams.INTEGRATION_ID,
        ],
        request=inline_serializer(
            name="GroupIntegrationCreateIssueRequest",
            fields={
                "title": serializers.CharField(
                    required=False,
                    help_text="The title for the external issue. If not provided, defaults to the Sentry issue title.",
                ),
                "description": serializers.CharField(
                    required=False,
                    help_text="The description for the external issue. If not provided, defaults to issue details from Sentry.",
                ),
            },
            help_text="The request body fields vary depending on the integration provider. Use the GET endpoint with `action=create` to retrieve the required fields and options for the specific integration.",
        ),
        responses={
            201: ExternalIssueLinkResponseSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOT_FOUND,
            503: OpenApiResponse(description="Service Unavailable - Integration provider error"),
        },
    )
    def post(self, request: Request, group, integration_id) -> Response:
        """
        Creates a new external issue and link it to a group.
        """
        if not request.user.is_authenticated:
            return Response(status=400)
        elif not self._has_issue_feature(group.organization, request.user):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=400)

        organization_id = group.project.organization_id
        result = integration_service.organization_context(
            organization_id=organization_id, integration_id=integration_id
        )
        integration = result.integration
        org_integration = result.organization_integration
        if not integration or not org_integration:
            return Response(status=404)

        if not self._has_issue_feature_on_integration(integration):
            return Response(
                {"detail": "This feature is not supported for this integration."}, status=400
            )

        installation = self._get_installation(integration, organization_id)

        with ProjectManagementEvent(
            action_type=ProjectManagementActionType.CREATE_EXTERNAL_ISSUE_VIA_ISSUE_DETAIL,
            integration=integration,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "provider": integration.provider,
                    "integration_id": integration.id,
                }
            )

            try:
                data = installation.create_issue(request.data)
            except IntegrationConfigurationError as exc:
                lifecycle.record_halt(exc)
                return Response({"non_field_errors": [str(exc)]}, status=400)
            except IntegrationFormError as exc:
                lifecycle.record_halt(exc)
                return Response(exc.field_errors, status=400)
            except IntegrationError as e:
                lifecycle.record_failure(e)
                return Response({"non_field_errors": [str(e)]}, status=400)
            except IntegrationProviderError as exc:
                lifecycle.record_halt(exc)
                return Response(
                    {
                        "detail": f"Something went wrong while communicating with {integration.provider}"
                    },
                    status=503,
                )

        external_issue_key = installation.make_external_key(data)
        external_issue, created = ExternalIssue.objects.get_or_create(
            organization_id=organization_id,
            integration_id=integration.id,
            key=external_issue_key,
            defaults={
                "title": data.get("title"),
                "description": data.get("description"),
                "metadata": data.get("metadata"),
            },
        )

        try:
            with transaction.atomic(router.db_for_write(GroupLink)):
                GroupLink.objects.create(
                    group_id=group.id,
                    project_id=group.project_id,
                    linked_type=GroupLink.LinkedType.issue,
                    linked_id=external_issue.id,
                    relationship=GroupLink.Relationship.references,
                )
        except IntegrityError:
            return Response({"detail": "That issue is already linked"}, status=400)

        if created:
            integration_issue_created.send_robust(
                integration=integration,
                organization=group.project.organization,
                user=request.user,
                sender=self.__class__,
            )
        installation.store_issue_last_defaults(group.project, request.user, request.data)

        self.create_issue_activity(request, group, installation, external_issue, new=True)

        # TODO(jess): return serialized issue
        url = data.get("url") or installation.get_issue_url(external_issue.key)
        context = {
            "id": external_issue.id,
            "key": external_issue.key,
            "url": url,
            "integrationId": external_issue.integration_id,
            "displayName": installation.get_issue_display_name(external_issue),
        }
        return Response(context, status=201)

    @extend_schema(
        operation_id="Link an Existing External Issue to an Issue",
        parameters=[
            IssueParams.ISSUES_OR_GROUPS,
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUE_ID,
            GlobalParams.INTEGRATION_ID,
        ],
        request=GroupIntegrationLinkIssueSerializer,
        responses={
            201: ExternalIssueLinkResponseSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, group, integration_id) -> Response:
        """
        Links an existing external issue to a group.
        """
        if not request.user.is_authenticated:
            return Response(status=400)
        elif not self._has_issue_feature(group.organization, request.user):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=400)

        external_issue_id = request.data.get("externalIssue")
        if not external_issue_id:
            return Response({"externalIssue": ["Issue ID is required"]}, status=400)

        organization_id = group.project.organization_id
        result = integration_service.organization_context(
            organization_id=organization_id, integration_id=integration_id
        )
        integration = result.integration
        org_integration = result.organization_integration
        if not integration or not org_integration:
            return Response(status=404)

        with ProjectManagementEvent(
            action_type=ProjectManagementActionType.LINK_EXTERNAL_ISSUE,
            integration=integration,
        ).capture() as lifecycle:
            if not self._has_issue_feature_on_integration(integration):
                return Response(
                    {"detail": "This feature is not supported for this integration."}, status=400
                )

            installation = self._get_installation(integration, organization_id)

            try:
                data = installation.get_issue(external_issue_id, data=request.data)
            except IntegrationFormError as exc:
                lifecycle.record_halt(exc)
                return Response(exc.field_errors, status=400)
            except IntegrationError as e:
                lifecycle.record_failure(e)
                return Response({"non_field_errors": [str(e)]}, status=400)

            defaults = {
                "title": data.get("title"),
                "description": data.get("description"),
                "metadata": data.get("metadata"),
            }

            external_issue_key = installation.make_external_key(data)
            external_issue, created = ExternalIssue.objects.get_or_create(
                organization_id=organization_id,
                integration_id=integration.id,
                key=external_issue_key,
                defaults=defaults,
            )

            if created:
                integration_issue_linked.send_robust(
                    integration=integration,
                    organization=group.project.organization,
                    user=request.user,
                    sender=self.__class__,
                )
            else:
                external_issue.update(**defaults)

            installation.store_issue_last_defaults(group.project, request.user, request.data)
            try:
                installation.after_link_issue(external_issue, data=request.data)
            except IntegrationFormError as exc:
                lifecycle.record_halt(exc)
                return Response(exc.field_errors, status=400)
            except IntegrationError as e:
                lifecycle.record_failure(e)
                return Response({"non_field_errors": [str(e)]}, status=400)

            try:
                with transaction.atomic(router.db_for_write(GroupLink)):
                    GroupLink.objects.create(
                        group_id=group.id,
                        project_id=group.project_id,
                        linked_type=GroupLink.LinkedType.issue,
                        linked_id=external_issue.id,
                        relationship=GroupLink.Relationship.references,
                    )
            except IntegrityError as exc:
                lifecycle.record_halt(exc)
                return Response({"non_field_errors": ["That issue is already linked"]}, status=400)

        self.create_issue_activity(request, group, installation, external_issue, new=False)

        # TODO(jess): would be helpful to return serialized external issue
        # once we have description, title, etc
        url = data.get("url") or installation.get_issue_url(external_issue.key)
        context = {
            "id": external_issue.id,
            "key": external_issue.key,
            "url": url,
            "integrationId": external_issue.integration_id,
            "displayName": installation.get_issue_display_name(external_issue),
        }
        return Response(context, status=201)

    @extend_schema(
        operation_id="Unlink an External Issue from an Issue",
        parameters=[
            IssueParams.ISSUES_OR_GROUPS,
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUE_ID,
            GlobalParams.INTEGRATION_ID,
            EXTERNAL_ISSUE_QUERY_PARAM,
        ],
        request=None,
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, group, integration_id) -> Response:
        """
        Deletes a link between a group and an external issue.
        """
        if not self._has_issue_feature(group.organization, request.user):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=400)

        # note here externalIssue refers to `ExternalIssue.id` whereas above
        # it refers to the id from the provider
        external_issue_id = request.GET.get("externalIssue")
        if not external_issue_id:
            return Response({"detail": "External ID required"}, status=400)

        organization_id = group.project.organization_id
        result = integration_service.organization_context(
            organization_id=organization_id, integration_id=integration_id
        )
        integration = result.integration
        org_integration = result.organization_integration
        if not integration or not org_integration:
            return Response(status=404)

        if not self._has_issue_feature_on_integration(integration):
            return Response(
                {"detail": "This feature is not supported for this integration."}, status=400
            )

        try:
            external_issue = ExternalIssue.objects.get(
                organization_id=organization_id, integration_id=integration.id, id=external_issue_id
            )
        except ExternalIssue.DoesNotExist:
            return Response(status=404)

        with transaction.atomic(router.db_for_write(GroupLink)):
            GroupLink.objects.get_group_issues(group, external_issue_id).delete()

            # check if other groups reference this external issue
            # and delete if not
            if not GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue, linked_id=external_issue_id
            ).exists():
                external_issue.delete()

        return Response(status=204)

    def _has_issue_feature(self, organization, user) -> bool:
        has_issue_basic = features.has(
            "organizations:integrations-issue-basic", organization, actor=user
        )

        has_issue_sync = features.has(
            "organizations:integrations-issue-sync", organization, actor=user
        )

        return has_issue_sync or has_issue_basic

    def _has_issue_feature_on_integration(self, integration: RpcIntegration) -> bool:
        return integration.has_feature(
            feature=IntegrationFeatures.ISSUE_BASIC
        ) or integration.has_feature(feature=IntegrationFeatures.ISSUE_SYNC)

    def _get_installation(
        self, integration: RpcIntegration, organization_id: int
    ) -> IssueBasicIntegration:
        installation = integration.get_installation(organization_id=organization_id)
        if not isinstance(installation, IssueBasicIntegration):
            raise ValueError(installation)
        return installation

    def create_issue_activity(
        self,
        request: Request,
        group: Group,
        installation: IssueBasicIntegration,
        external_issue: ExternalIssue,
        new: bool,
    ):
        issue_information = {
            "title": external_issue.title,
            "provider": installation.model.get_provider().name,
            "location": installation.get_issue_url(external_issue.key),
            "label": installation.get_issue_display_name(external_issue) or external_issue.key,
            "new": new,
        }
        Activity.objects.create(
            project=group.project,
            group=group,
            type=ActivityType.CREATE_ISSUE.value,
            user_id=request.user.id,
            data=issue_information,
        )
