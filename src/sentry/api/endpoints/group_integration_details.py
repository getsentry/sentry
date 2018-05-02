from __future__ import absolute_import

from django.db import IntegrityError, transaction

from rest_framework.response import Response

from sentry.api.bases import GroupEndpoint
from sentry.models import ExternalIssue, GroupLink, OrganizationIntegration


class GroupIntegrationDetails(GroupEndpoint):
    # was thinking put for link an existing issue, post for create new issue?
    def put(self, request, group, integration_id):
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

        external_issue_id = request.DATA.get('externalIssue')

        if not external_issue_id:
            return Response({'detail': 'External ID required'}, status=400)

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
