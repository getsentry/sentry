from __future__ import absolute_import

import six
from django.db import IntegrityError, transaction
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.integration import IntegrationIssueConfigSerializer
from sentry.integrations import IntegrationFeatures
from sentry.shared_integrations.exceptions import IntegrationError, IntegrationFormError
from sentry.models import Activity, ExternalIssue, GroupLink, Integration
from sentry.signals import integration_issue_created, integration_issue_linked
from sentry.web.decorators import transaction_start


MISSING_FEATURE_MESSAGE = "Your organization does not have access to this feature."


class GroupIntegrationDetailsEndpoint(GroupEndpoint):
    def _has_issue_feature(self, organization, user):
        has_issue_basic = features.has(
            "organizations:integrations-issue-basic", organization, actor=user
        )

        has_issue_sync = features.has(
            "organizations:integrations-issue-sync", organization, actor=user
        )

        return has_issue_sync or has_issue_basic

    def create_issue_activity(self, request, group, installation, external_issue):
        issue_information = {
            "title": external_issue.title,
            "provider": installation.model.get_provider().name,
            "location": installation.get_issue_url(external_issue.key),
            "label": installation.get_issue_display_name(external_issue) or external_issue.key,
        }
        Activity.objects.create(
            project=group.project,
            group=group,
            type=Activity.CREATE_ISSUE,
            user=request.user,
            data=issue_information,
        )

    @transaction_start("GroupIntegrationDetailsEndpoint")
    def get(self, request, group, integration_id):
        if not self._has_issue_feature(group.organization, request.user):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=400)

        # Keep link/create separate since create will likely require
        # many external API calls that aren't necessary if the user is
        # just linking
        action = request.GET.get("action")
        if action not in {"link", "create"}:
            return Response({"detail": "Action is required and should be either link or create"})

        organization_id = group.project.organization_id
        try:
            integration = Integration.objects.get(id=integration_id, organizations=organization_id)
        except Integration.DoesNotExist:
            return Response(status=404)

        if not (
            integration.has_feature(IntegrationFeatures.ISSUE_BASIC)
            or integration.has_feature(IntegrationFeatures.ISSUE_SYNC)
        ):
            return Response(
                {"detail": "This feature is not supported for this integration."}, status=400
            )

        try:
            return Response(
                serialize(
                    integration,
                    request.user,
                    IntegrationIssueConfigSerializer(group, action, params=request.GET),
                    organization_id=organization_id,
                )
            )
        except IntegrationError as e:
            return Response({"detail": six.text_type(e)}, status=400)

    # was thinking put for link an existing issue, post for create new issue?
    @transaction_start("GroupIntegrationDetailsEndpoint")
    def put(self, request, group, integration_id):
        if not self._has_issue_feature(group.organization, request.user):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=400)

        external_issue_id = request.data.get("externalIssue")
        if not external_issue_id:
            return Response({"externalIssue": ["Issue ID is required"]}, status=400)

        organization_id = group.project.organization_id
        try:
            integration = Integration.objects.get(id=integration_id, organizations=organization_id)
        except Integration.DoesNotExist:
            return Response(status=404)

        if not (
            integration.has_feature(IntegrationFeatures.ISSUE_BASIC)
            or integration.has_feature(IntegrationFeatures.ISSUE_SYNC)
        ):
            return Response(
                {"detail": "This feature is not supported for this integration."}, status=400
            )

        installation = integration.get_installation(organization_id)
        try:
            data = installation.get_issue(external_issue_id, data=request.data)
        except IntegrationFormError as exc:
            return Response(exc.field_errors, status=400)
        except IntegrationError as e:
            return Response({"non_field_errors": [six.text_type(e)]}, status=400)

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
            return Response(exc.field_errors, status=400)
        except IntegrationError as e:
            return Response({"non_field_errors": [six.text_type(e)]}, status=400)

        try:
            with transaction.atomic():
                GroupLink.objects.create(
                    group_id=group.id,
                    project_id=group.project_id,
                    linked_type=GroupLink.LinkedType.issue,
                    linked_id=external_issue.id,
                    relationship=GroupLink.Relationship.references,
                )
        except IntegrityError:
            return Response({"non_field_errors": ["That issue is already linked"]}, status=400)

        self.create_issue_activity(request, group, installation, external_issue)

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

    @transaction_start("GroupIntegrationDetailsEndpoint")
    def post(self, request, group, integration_id):
        if not self._has_issue_feature(group.organization, request.user):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=400)

        organization_id = group.project.organization_id
        try:
            integration = Integration.objects.get(id=integration_id, organizations=organization_id)
        except Integration.DoesNotExist:
            return Response(status=404)

        if not (
            integration.has_feature(IntegrationFeatures.ISSUE_BASIC)
            or integration.has_feature(IntegrationFeatures.ISSUE_SYNC)
        ):
            return Response(
                {"detail": "This feature is not supported for this integration."}, status=400
            )

        installation = integration.get_installation(organization_id)
        try:
            data = installation.create_issue(request.data)
        except IntegrationFormError as exc:
            return Response(exc.field_errors, status=400)
        except IntegrationError as e:
            return Response({"non_field_errors": [six.text_type(e)]}, status=400)

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
            with transaction.atomic():
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

        self.create_issue_activity(request, group, installation, external_issue)

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

    @transaction_start("GroupIntegrationDetailsEndpoint")
    def delete(self, request, group, integration_id):
        if not self._has_issue_feature(group.organization, request.user):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=400)

        # note here externalIssue refers to `ExternalIssue.id` whereas above
        # it refers to the id from the provider
        external_issue_id = request.GET.get("externalIssue")
        if not external_issue_id:
            return Response({"detail": "External ID required"}, status=400)

        organization_id = group.project.organization_id
        try:
            integration = Integration.objects.get(id=integration_id, organizations=organization_id)
        except Integration.DoesNotExist:
            return Response(status=404)

        if not (
            integration.has_feature(IntegrationFeatures.ISSUE_BASIC)
            or integration.has_feature(IntegrationFeatures.ISSUE_SYNC)
        ):
            return Response(
                {"detail": "This feature is not supported for this integration."}, status=400
            )

        try:
            external_issue = ExternalIssue.objects.get(
                organization_id=organization_id, integration_id=integration.id, id=external_issue_id
            )
        except ExternalIssue.DoesNotExist:
            return Response(status=404)

        with transaction.atomic():
            GroupLink.objects.filter(
                group_id=group.id,
                project_id=group.project_id,
                linked_type=GroupLink.LinkedType.issue,
                linked_id=external_issue_id,
                relationship=GroupLink.Relationship.references,
            ).delete()

            # check if other groups reference this external issue
            # and delete if not
            if not GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue, linked_id=external_issue_id
            ).exists():
                external_issue.delete()

        return Response(status=204)
