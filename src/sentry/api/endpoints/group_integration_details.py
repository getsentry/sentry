from __future__ import absolute_import

from django.db import IntegrityError, transaction

from rest_framework.response import Response

from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.integration import IntegrationIssueConfigSerializer
from sentry.integrations import IntegrationFeatures
from sentry.integrations.exceptions import IntegrationError
from sentry.models import ExternalIssue, GroupLink, OrganizationIntegration


class GroupIntegrationDetailsEndpoint(GroupEndpoint):
    def get(self, request, group, integration_id):
        # Keep link/create separate since create will likely require
        # many external API calls that aren't necessary if the user is
        # just linking
        action = request.GET.get('action')
        if action not in {'link', 'create'}:
            return Response({'detail': 'Action is required and should be either link or create'})

        organization_id = group.project.organization_id
        try:
            # check org permissions
            # TODO(jess): should this eventually check ProjectIntegration?
            integration = OrganizationIntegration.objects.filter(
                integration_id=integration_id,
                organization_id=organization_id,
            ).select_related('integration').get().integration
        except OrganizationIntegration.DoesNotExist:
            return Response(status=404)

        if not integration.has_feature(IntegrationFeatures.ISSUE_SYNC):
            return Response(
                {'detail': 'This feature is not supported for this integration.'}, status=400)

        # TODO(jess): add create issue config to serializer
        return Response(
            serialize(
                integration,
                request.user,
                IntegrationIssueConfigSerializer(group, action, params=request.GET),
            )
        )

    # was thinking put for link an existing issue, post for create new issue?
    def put(self, request, group, integration_id):
        external_issue_id = request.DATA.get('externalIssue')
        if not external_issue_id:
            return Response({'detail': 'External ID required'}, status=400)

        organization_id = group.project.organization_id
        try:
            # check org permissions
            # TODO(jess): should this eventually check ProjectIntegration?
            integration = OrganizationIntegration.objects.filter(
                integration_id=integration_id,
                organization_id=organization_id,
            ).select_related('integration').get().integration
        except OrganizationIntegration.DoesNotExist:
            return Response(status=404)

        if not integration.has_feature(IntegrationFeatures.ISSUE_SYNC):
            return Response(
                {'detail': 'This feature is not supported for this integration.'}, status=400)

        # TODO(jess): some validation from provider to ensure this
        # issue id is valid and also maybe to fetch the title/description
        # should go here

        external_issue = ExternalIssue.objects.get_or_create(
            organization_id=organization_id,
            integration_id=integration.id,
            key=external_issue_id,
        )[0]

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
            return Response({'detail': 'That issue is already linked'}, status=400)

        # TODO(jess): would be helpful to return serialized external issue
        # once we have description, title, etc
        return Response(status=201)

    def post(self, request, group, integration_id):
        organization_id = group.project.organization_id
        try:
            # check org permissions
            # TODO(jess): should this eventually check ProjectIntegration?
            integration = OrganizationIntegration.objects.filter(
                integration_id=integration_id,
                organization_id=organization_id,
            ).select_related('integration').get().integration
        except OrganizationIntegration.DoesNotExist:
            return Response(status=404)

        if not integration.has_feature(IntegrationFeatures.ISSUE_SYNC):
            return Response(
                {'detail': 'This feature is not supported for this integration.'}, status=400)

        installation = integration.get_installation()
        try:
            data = installation.create_issue(request.DATA)
        except IntegrationError as exc:
            return Response({'detail': exc.message}, status=400)

        external_issue = ExternalIssue.objects.get_or_create(
            organization_id=organization_id,
            integration_id=integration.id,
            key=data['key'],
            defaults={
                'title': data.get('title'),
                'description': data.get('description'),
            }
        )[0]

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
            return Response({'detail': 'That issue is already linked'}, status=400)

        # TODO(jess): return serialized issue
        return Response(status=201)
