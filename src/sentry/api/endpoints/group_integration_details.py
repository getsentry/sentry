from collections.abc import Mapping, MutableMapping
from typing import Any

from django.db import IntegrityError, router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.integrations.api.serializers.models.integration import IntegrationSerializer
from sentry.integrations.base import IntegrationFeatures, IntegrationInstallation
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
)
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.shared_integrations.exceptions import (
    IntegrationError,
    IntegrationFormError,
    IntegrationInstallationConfigurationError,
)
from sentry.signals import integration_issue_created, integration_issue_linked
from sentry.types.activity import ActivityType
from sentry.users.models.user import User

MISSING_FEATURE_MESSAGE = "Your organization does not have access to this feature."


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
        self, obj: RpcIntegration, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> MutableMapping[str, Any]:
        data = super().serialize(obj, attrs, user)

        if self.action == "link":
            data["linkIssueConfig"] = self.config
        if self.action == "create":
            data["createIssueConfig"] = self.config

        return data


@region_silo_endpoint
class GroupIntegrationDetailsEndpoint(GroupEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }

    def _has_issue_feature(self, organization, user):
        has_issue_basic = features.has(
            "organizations:integrations-issue-basic", organization, actor=user
        )

        has_issue_sync = features.has(
            "organizations:integrations-issue-sync", organization, actor=user
        )

        return has_issue_sync or has_issue_basic

    def _has_issue_feature_on_integration(self, integration: RpcIntegration):
        return integration.has_feature(
            feature=IntegrationFeatures.ISSUE_BASIC
        ) or integration.has_feature(feature=IntegrationFeatures.ISSUE_SYNC)

    def create_issue_activity(
        self,
        request: Request,
        group: Group,
        installation: IntegrationInstallation,
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

    def get(self, request: Request, group, integration_id) -> Response:
        if not self._has_issue_feature(group.organization, request.user):
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

        installation = integration.get_installation(organization_id=organization_id)
        config = None
        try:
            if action == "link":
                config = installation.get_link_issue_config(group, params=request.GET)

            if action == "create":
                config = installation.get_create_issue_config(
                    group, request.user, params=request.GET
                )
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

    # was thinking put for link an existing issue, post for create new issue?
    def put(self, request: Request, group, integration_id) -> Response:
        if not self._has_issue_feature(group.organization, request.user):
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

            installation = integration.get_installation(organization_id=organization_id)

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

    def post(self, request: Request, group, integration_id) -> Response:
        if not self._has_issue_feature(group.organization, request.user):
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

        installation = integration.get_installation(organization_id=organization_id)

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
            except IntegrationInstallationConfigurationError as exc:
                lifecycle.record_halt(exc)
                return Response({"non_field_errors": [str(exc)]}, status=400)
            except IntegrationFormError as exc:
                lifecycle.record_halt(exc)
                return Response(exc.field_errors, status=400)
            except IntegrationError as e:
                lifecycle.record_failure(e)
                return Response({"non_field_errors": [str(e)]}, status=400)

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

    def delete(self, request: Request, group, integration_id) -> Response:
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
