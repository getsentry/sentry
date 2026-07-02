from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.serializers import Serializer, serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.integration_examples import IntegrationExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.response_types import DetailResponse, ValidationErrorResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.integrations.api.serializers.models.integration import (
    IntegrationSerializer,
    IntegrationSerializerResponse,
)
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
)
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.issues.action_log import (
    publish_action,
    resolve_action_actor,
    resolve_action_source,
)
from sentry.issues.action_log.types import (
    CreateExternalIssueAction,
    LinkExternalIssueAction,
    UnlinkExternalIssueAction,
)
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.organization import Organization
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


class IntegrationIssueConfigResponse(IntegrationSerializerResponse, total=False):
    # Exactly one of these is present on a given response, selected by the `action`
    # query param: `linkIssueConfig` for `link`, `createIssueConfig` for `create`.
    linkIssueConfig: list[dict[str, Any]]
    createIssueConfig: list[dict[str, Any]]


class ExternalIssueLinkResponse(TypedDict):
    id: int
    key: str
    url: str
    integrationId: int
    displayName: str


class IntegrationIssueConfigSerializer(Serializer[IntegrationIssueConfigResponse]):
    def __init__(self, action: str, config: list[dict[str, Any]]) -> None:
        self.action = action
        self.config = config

    def serialize(
        self,
        obj: Integration | RpcIntegration,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> IntegrationIssueConfigResponse:
        base = IntegrationSerializer().serialize(obj, attrs, user)
        if self.action == "link":
            return {**base, "linkIssueConfig": self.config}
        return {**base, "createIssueConfig": self.config}


ACTION_PARAM = OpenApiParameter(
    name="action",
    location=OpenApiParameter.QUERY,
    type=OpenApiTypes.STR,
    required=True,
    enum=["link", "create"],
    description=(
        "Whether to fetch the config for linking an existing external issue (`link`) "
        "or creating a new one (`create`)."
    ),
)


@extend_schema(tags=["Integration"])
@cell_silo_endpoint
class GroupIntegrationDetailsEndpoint(GroupEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
        "DELETE": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve an Integration's Issue Config for an Issue",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            GlobalParams.INTEGRATION_ID,
            ACTION_PARAM,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "IntegrationIssueConfigResponse", IntegrationIssueConfigResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IntegrationExamples.GROUP_INTEGRATION_ISSUE_CONFIG,
    )
    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-integration-details"])
    def get(
        self, request: Request, group: Group, integration_id: str
    ) -> Response[IntegrationIssueConfigResponse] | Response[DetailResponse]:
        """
        Retrieve the form fields needed to either link an existing external issue
        (such as a Jira ticket or GitHub issue) to a Sentry issue, or create a new
        one. The returned `linkIssueConfig`/`createIssueConfig` describes the fields
        to submit back to this endpoint via `PUT`/`POST` respectively.
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
            return Response(
                {"detail": "Action is required and should be either link or create"}, status=400
            )

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
                IntegrationIssueConfigSerializer(action, config),
                organization_id=organization_id,
            )
        )

    @extend_schema(
        operation_id="Create an External Issue and Link It to an Issue",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            GlobalParams.INTEGRATION_ID,
        ],
        request=inline_serializer(
            "CreateExternalIssueRequest",
            fields={
                "title": serializers.CharField(
                    help_text="The title of the external issue to create."
                ),
                "description": serializers.CharField(
                    required=False,
                    help_text="The description (body) of the external issue to create.",
                ),
            },
        ),
        responses={
            201: inline_sentry_response_serializer(
                "ExternalIssueLinkResponse", ExternalIssueLinkResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IntegrationExamples.EXTERNAL_ISSUE_LINK,
    )
    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-integration-details"])
    def post(
        self, request: Request, group: Group, integration_id: str
    ) -> (
        Response[ExternalIssueLinkResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
    ):
        """
        Create a new issue in the external provider (such as a Jira ticket or GitHub
        issue) and link it to the given Sentry issue. The accepted fields are
        integration-specific; fetch them from the `createIssueConfig` returned by the
        `GET` endpoint with `?action=create`.
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
                return Response(dict(exc.field_errors or {}), status=400)
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

        publish_action(
            CreateExternalIssueAction(
                provider=integration.provider,
                external_issue_key=external_issue.key,
            ),
            source=resolve_action_source(request),
            group_id=group.id,
            project=group.project,
            actor=resolve_action_actor(request),
        )

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
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            GlobalParams.INTEGRATION_ID,
        ],
        request=inline_serializer(
            "LinkExternalIssueRequest",
            fields={
                "externalIssue": serializers.CharField(
                    help_text="The identifier of the existing external issue to link, "
                    "as understood by the provider (such as a Jira issue key)."
                ),
            },
        ),
        responses={
            201: inline_sentry_response_serializer(
                "ExternalIssueLinkResponse", ExternalIssueLinkResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IntegrationExamples.EXTERNAL_ISSUE_LINK,
    )
    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-integration-details"])
    def put(
        self, request: Request, group: Group, integration_id: str
    ) -> (
        Response[ExternalIssueLinkResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
    ):
        """
        Link an issue that already exists in the external provider (such as a Jira
        ticket or GitHub issue) to the given Sentry issue. Additional accepted fields
        are integration-specific; fetch them from the `linkIssueConfig` returned by
        the `GET` endpoint with `?action=link`.
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
                return Response(dict(exc.field_errors or {}), status=400)
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
                return Response(dict(exc.field_errors or {}), status=400)
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

        publish_action(
            LinkExternalIssueAction(
                provider=integration.provider,
                external_issue_key=external_issue.key,
            ),
            source=resolve_action_source(request),
            group_id=group.id,
            project=group.project,
            actor=resolve_action_actor(request),
        )

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
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            GlobalParams.INTEGRATION_ID,
            OpenApiParameter(
                name="externalIssue",
                location=OpenApiParameter.QUERY,
                type=OpenApiTypes.INT,
                required=True,
                description="The ID of the `ExternalIssue` link to remove.",
            ),
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-integration-details"])
    def delete(
        self, request: Request, group: Group, integration_id: str
    ) -> Response[None] | Response[DetailResponse]:
        """
        Remove the link between a Sentry issue and an external issue. If no other
        Sentry issues reference the external issue, the link record is deleted
        entirely. This does not delete the issue in the external provider.
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
            deleted, _ = GroupLink.objects.get_group_issues(group, external_issue_id).delete()

            # check if other groups reference this external issue
            # and delete if not
            if not GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue, linked_id=external_issue_id
            ).exists():
                external_issue.delete()

        # Only record the action when a link was actually removed; the endpoint still
        # returns 204 when nothing was linked to this group.
        if deleted:
            publish_action(
                UnlinkExternalIssueAction(
                    provider=integration.provider,
                    external_issue_key=external_issue.key,
                ),
                source=resolve_action_source(request),
                group_id=group.id,
                project=group.project,
                actor=resolve_action_actor(request),
            )

        return Response(status=204)

    def _has_issue_feature(
        self, organization: Organization, user: User | RpcUser | AnonymousUser
    ) -> bool:
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
    ) -> None:
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
