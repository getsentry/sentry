from __future__ import absolute_import

from sentry.models import (
    ExternalIssue, Group, GroupStatus, GroupLink, Integration, OrganizationIntegration
)
from sentry.testutils import TestCase


class IssueSyncIntegration(TestCase):
    def test_status_sync_inbound_resolve(self):
        group = self.group
        assert group.status == GroupStatus.UNRESOLVED

        integration = Integration.objects.create(
            provider='example',
            external_id='123456',
        )
        integration.add_organization(group.organization.id)

        OrganizationIntegration.objects.filter(
            integration_id=integration.id,
            organization_id=group.organization.id,
        ).update(
            config={
                'sync_comments': True,
                'sync_status_outbound': True,
                'sync_status_inbound': True,
                'sync_assignee_outbound': True,
                'sync_assignee_inbound': True,
            }
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id,
            integration_id=integration.id,
            key='APP-123',
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        installation = integration.get_installation(group.organization.id)

        with self.feature('organizations:integrations-issue-sync'):
            installation.sync_status_inbound(external_issue.key, {
                'project_id': 'APP',
                'status': {
                    'id': '12345',
                    'category': 'done',
                },
            })

            assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

    def test_status_sync_inbound_unresolve(self):
        group = self.group
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.status == GroupStatus.RESOLVED

        integration = Integration.objects.create(
            provider='example',
            external_id='123456',
        )
        integration.add_organization(group.organization.id)

        OrganizationIntegration.objects.filter(
            integration_id=integration.id,
            organization_id=group.organization.id,
        ).update(
            config={
                'sync_comments': True,
                'sync_status_outbound': True,
                'sync_status_inbound': True,
                'sync_assignee_outbound': True,
                'sync_assignee_inbound': True,
            }
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id,
            integration_id=integration.id,
            key='APP-123',
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        installation = integration.get_installation(group.organization.id)

        with self.feature('organizations:integrations-issue-sync'):
            installation.sync_status_inbound(external_issue.key, {
                'project_id': 'APP',
                'status': {
                    'id': '12345',
                    'category': 'in_progress',
                },
            })

            assert Group.objects.get(id=group.id).status == GroupStatus.UNRESOLVED
