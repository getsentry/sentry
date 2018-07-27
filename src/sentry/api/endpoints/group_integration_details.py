from __future__ import absolute_import

from django.db import IntegrityError, transaction

from rest_framework.response import Response

from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.integration import IntegrationIssueConfigSerializer
from sentry.integrations import IntegrationFeatures
from sentry.integrations.exceptions import IntegrationError
from sentry.models import ExternalIssue, GroupLink, Integration


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
            # TODO(jess): should this eventually check ProjectIntegration?
            integration = Integration.objects.get(
                id=integration_id,
                organizations=organization_id,
            )
        except Integration.DoesNotExist:
            return Response(status=404)

        if not (integration.has_feature(IntegrationFeatures.ISSUE_BASIC) or integration.has_feature(
                IntegrationFeatures.ISSUE_SYNC)):
            return Response(
                {'detail': 'This feature is not supported for this integration.'}, status=400)

        # TODO(jess): add create issue config to serializer
        return Response(
            serialize(
                integration,
                request.user,
                IntegrationIssueConfigSerializer(group, action, params=request.GET),
                organization_id=organization_id
            )
        )

    # was thinking put for link an existing issue, post for create new issue?
    def put(self, request, group, integration_id):
        external_issue_id = request.DATA.get('externalIssue')
        if not external_issue_id:
            return Response({'detail': 'External ID required'}, status=400)

        organization_id = group.project.organization_id
        try:
            # TODO(jess): should this eventually check ProjectIntegration?
            integration = Integration.objects.get(
                id=integration_id,
                organizations=organization_id,
            )
        except Integration.DoesNotExist:
            return Response(status=404)

        if not (integration.has_feature(IntegrationFeatures.ISSUE_BASIC) or integration.has_feature(
                IntegrationFeatures.ISSUE_SYNC)):
            return Response(
                {'detail': 'This feature is not supported for this integration.'}, status=400)

        installation = integration.get_installation(organization_id)
        try:
            data = installation.get_issue(external_issue_id, data=request.DATA)
        except IntegrationError as exc:
            return Response({'detail': exc.message}, status=400)

        defaults = {
            'title': data.get('title'),
            'description': data.get('description'),
        }

        external_issue_key = installation.make_external_key(data)
        external_issue, created = ExternalIssue.objects.get_or_create(
            organization_id=organization_id,
            integration_id=integration.id,
            key=external_issue_key,
            defaults=defaults,
        )

        if not created:
            external_issue.update(**defaults)

        installation.after_link_issue(external_issue, data=request.DATA)

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
            return Response({'non_field_errors': ['That issue is already linked']}, status=400)

        # TODO(jess): would be helpful to return serialized external issue
        # once we have description, title, etc
        url = data.get('url') or installation.get_issue_url(external_issue.key)
        context = {
            'id': external_issue.id,
            'key': external_issue.key,
            'url': url,
            'integrationId': external_issue.integration_id,
        }
        return Response(context, status=201)

    def post(self, request, group, integration_id):
        organization_id = group.project.organization_id
        try:
            # TODO(jess): should this eventually check ProjectIntegration?
            integration = Integration.objects.get(
                id=integration_id,
                organizations=organization_id,
            )
        except Integration.DoesNotExist:
            return Response(status=404)

        if not (integration.has_feature(IntegrationFeatures.ISSUE_BASIC) or integration.has_feature(
                IntegrationFeatures.ISSUE_SYNC)):
            return Response(
                {'detail': 'This feature is not supported for this integration.'}, status=400)

        installation = integration.get_installation(organization_id)
        try:
            data = installation.create_issue(request.DATA)
        except IntegrationError as exc:
            return Response({'non_field_errors': exc.message}, status=400)

        print('DATA')
        print(data)
        external_issue_key = installation.make_external_key(data)
        external_issue = ExternalIssue.objects.get_or_create(
            organization_id=organization_id,
            integration_id=integration.id,
            key=external_issue_key,
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
        url = data.get('url') or installation.get_issue_url(external_issue.key)
        context = {
            'id': external_issue.id,
            'key': external_issue.key,
            'url': url,
            'integrationId': external_issue.integration_id,

        }
        return Response(context, status=201)

    def delete(self, request, group, integration_id):
        # note here externalIssue refers to `ExternalIssue.id` wheras above
        # it refers to the id from the provider
        external_issue_id = request.GET.get('externalIssue')
        if not external_issue_id:
            return Response({'detail': 'External ID required'}, status=400)

        organization_id = group.project.organization_id
        try:
            integration = Integration.objects.get(
                id=integration_id,
                organizations=organization_id,
            )
        except Integration.DoesNotExist:
            return Response(status=404)

        if not (integration.has_feature(IntegrationFeatures.ISSUE_BASIC) or integration.has_feature(
                IntegrationFeatures.ISSUE_SYNC)):
            return Response(
                {'detail': 'This feature is not supported for this integration.'}, status=400)

        try:
            external_issue = ExternalIssue.objects.get(
                organization_id=organization_id,
                integration_id=integration.id,
                id=external_issue_id,
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
                linked_type=GroupLink.LinkedType.issue,
                linked_id=external_issue_id,
            ).exists():
                external_issue.delete()

        return Response(status=204)
