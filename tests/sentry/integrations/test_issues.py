from __future__ import absolute_import
from sentry.models import ExternalIssue, Group, GroupLink, GroupStatus, Integration
from sentry.integrations.issues import sync_group_status_inbound
from sentry.testutils import TestCase


class SyncGroupStatusInboundTest(TestCase):
    def setUp(self):
        self.integration = Integration.objects.create(
            provider='example',
            external_id='example',
            name='example',
        )
        self.status1 = 'Status1'
        self.status2 = 'Status2'

        organization1 = self.create_organization()
        organization2 = self.create_organization()
        self.integration.add_organization(organization1.id)
        self.integration.add_organization(organization2.id)

        project1 = self.create_project(organization=organization1)
        project2 = self.create_project(organization=organization1)
        project3 = self.create_project(organization=organization2)

        config1 = {'resolve_when': self.status1, 'unresolve_when': self.status2}
        config2 = {'resolve_when': self.status2, 'unresolve_when': self.status1}
        config3 = {'resolve_when': self.status1, 'unresolve_when': self.status2}

        self.integration.add_project(project1.id, config1)
        self.integration.add_project(project2.id, config2)
        self.integration.add_project(project3.id, config3)

        self.external_issue_key = 'APP-123'
        self.external_issue_org1 = ExternalIssue.objects.create(
            organization_id=organization1.id,
            integration_id=self.integration.id,
            key=self.external_issue_key,
        )
        self.external_issue_org2 = ExternalIssue.objects.create(
            organization_id=organization2.id,
            integration_id=self.integration.id,
            key=self.external_issue_key,
        )
        groups1 = self.create_groups(5, project1)
        groups2 = self.create_groups(5, project2)
        groups3 = self.create_groups(5, project3)

        self.link_groups(groups1, self.external_issue_org1)
        self.link_groups(groups2, self.external_issue_org1)
        self.link_groups(groups3, self.external_issue_org2)

        self.project1_group_ids = [group.id for group in groups1]
        self.project2_group_ids = [group.id for group in groups2]
        self.project3_group_ids = [group.id for group in groups3]

    def create_groups(self, num_groups, project):
        groups = []
        for i in range(num_groups):
            status = GroupStatus.UNRESOLVED if i % 2 == 0 else GroupStatus.RESOLVED
            group = self.create_group(project=project, status=status)
            groups.append(group)
        return groups

    def link_groups(self, groups, external_issue):
        for group in groups:
            GroupLink.objects.create(
                linked_id=external_issue.id,
                linked_type=GroupLink.LinkedType.issue,
                group_id=group.id,
                project_id=group.project.id,
                data={},
            )

    def get_group_ids(self, group_ids, status):
        return [g.id for g in Group.objects.filter(id__in=group_ids, status=status)]

    def test_sync_group_status_inbound(self):
        sync_group_status_inbound(
            integration=self.integration,
            status_value=self.status1,
            external_issue_key=self.external_issue_key,
        )
        assert sorted(self.get_group_ids(self.project1_group_ids,
                                         GroupStatus.RESOLVED)) == sorted([1, 2, 3, 4, 5])
        assert self.get_group_ids(self.project1_group_ids, GroupStatus.UNRESOLVED) == []

        assert self.get_group_ids(self.project2_group_ids, GroupStatus.RESOLVED) == []
        assert sorted(self.get_group_ids(self.project2_group_ids,
                                         GroupStatus.UNRESOLVED)) == sorted([6, 7, 8, 9, 10])

        assert self.get_group_ids(self.project3_group_ids, GroupStatus.UNRESOLVED) == []
        assert sorted(
            self.get_group_ids(
                self.project3_group_ids,
                GroupStatus.RESOLVED)) == [
            11,
            12,
            13,
            14,
            15]
