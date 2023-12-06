from unittest import mock

import pytest

from sentry.integrations.example.integration import ExampleIntegration
from sentry.integrations.utils import sync_group_assignee_inbound
from sentry.models.activity import Activity
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouplink import GroupLink
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = requires_snuba


@region_silo_test
class GroupAssigneeTestCase(TestCase):
    def test_constraints(self):
        # Can't both be assigned
        with pytest.raises(AssertionError):
            GroupAssignee.objects.create(
                group=self.group, project=self.group.project, user_id=self.user.id, team=self.team
            )

        # Can't have nobody assigned
        with pytest.raises(AssertionError):
            GroupAssignee.objects.create(
                group=self.group, project=self.group.project, user_id=None, team=None
            )

    def test_assign_user(self):
        GroupAssignee.objects.assign(self.group, self.user)

        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, user_id=self.user.id, team__isnull=True
        ).exists()

        activity = Activity.objects.get(
            project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
        )

        assert activity.data["assignee"] == str(self.user.id)
        assert activity.data["assigneeEmail"] == self.user.email
        assert activity.data["assigneeType"] == "user"

    def test_assign_team(self):
        GroupAssignee.objects.assign(self.group, self.team)

        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, team=self.team, user_id__isnull=True
        ).exists()

        activity = Activity.objects.get(
            project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
        )

        assert activity.data["assignee"] == str(self.team.id)
        assert activity.data["assigneeEmail"] is None
        assert activity.data["assigneeType"] == "team"

    def test_create_only(self):
        result = GroupAssignee.objects.assign(self.group, self.user)
        assert result == {"new_assignment": True, "updated_assignment": False}

        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, user_id=self.user.id, team__isnull=True
        ).exists()
        activity = Activity.objects.get(
            project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
        )
        assert activity.data["assignee"] == str(self.user.id)
        assert activity.data["assigneeEmail"] == self.user.email
        assert activity.data["assigneeType"] == "user"

        other_user = self.create_user()
        result = GroupAssignee.objects.assign(self.group, other_user, create_only=True)
        assert result == {"new_assignment": False, "updated_assignment": False}
        # Assignee should not have changed
        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, user_id=self.user.id, team__isnull=True
        ).exists()
        # Should be no new activity rows
        activity = Activity.objects.get(
            project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
        )
        assert activity.data["assignee"] == str(self.user.id)
        assert activity.data["assigneeEmail"] == self.user.email
        assert activity.data["assigneeType"] == "user"

    def test_reassign_user_to_team(self):
        GroupAssignee.objects.assign(self.group, self.user)

        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, user_id=self.user.id, team__isnull=True
        ).exists()

        GroupAssignee.objects.assign(self.group, self.team)

        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, team=self.team, user_id__isnull=True
        ).exists()

        activity = list(
            Activity.objects.filter(
                project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
            ).order_by("id")
        )

        assert activity[0].data["assignee"] == str(self.user.id)
        assert activity[0].data["assigneeEmail"] == self.user.email
        assert activity[0].data["assigneeType"] == "user"

        assert activity[1].data["assignee"] == str(self.team.id)
        assert activity[1].data["assigneeEmail"] is None
        assert activity[1].data["assigneeType"] == "team"

    @mock.patch.object(ExampleIntegration, "sync_assignee_outbound")
    def test_assignee_sync_outbound_assign(self, mock_sync_assignee_outbound):
        group = self.group
        integration = self.create_integration(
            organization=group.organization,
            external_id="123456",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        with self.feature({"organizations:integrations-issue-sync": True}):
            with self.tasks():
                GroupAssignee.objects.assign(self.group, self.user)

                mock_sync_assignee_outbound.assert_called_with(
                    external_issue, user_service.get_user(self.user.id), assign=True
                )

                assert GroupAssignee.objects.filter(
                    project=self.group.project,
                    group=self.group,
                    user_id=self.user.id,
                    team__isnull=True,
                ).exists()

                activity = Activity.objects.get(
                    project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
                )

                assert activity.data["assignee"] == str(self.user.id)
                assert activity.data["assigneeEmail"] == self.user.email
                assert activity.data["assigneeType"] == "user"

    @mock.patch.object(ExampleIntegration, "sync_assignee_outbound")
    def test_assignee_sync_outbound_unassign(self, mock_sync_assignee_outbound):
        group = self.group

        integration = self.create_integration(
            organization=group.organization,
            external_id="123456",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        GroupAssignee.objects.assign(self.group, self.user)

        with self.feature({"organizations:integrations-issue-sync": True}):
            with self.tasks():
                GroupAssignee.objects.deassign(self.group)
                mock_sync_assignee_outbound.assert_called_with(external_issue, None, assign=False)

                assert not GroupAssignee.objects.filter(
                    project=self.group.project,
                    group=self.group,
                    user_id=self.user.id,
                    team__isnull=True,
                ).exists()

                assert Activity.objects.filter(
                    project=self.group.project, group=self.group, type=ActivityType.UNASSIGNED.value
                ).exists()

    def test_assignee_sync_inbound_assign(self):
        group = self.group
        user_no_access = self.create_user()
        user_w_access = self.user

        integration = self.create_integration(
            organization=group.organization,
            external_id="123456",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        with self.feature("organizations:integrations-issue-sync"):
            # no permissions
            groups_updated = sync_group_assignee_inbound(
                integration, user_no_access.email, "APP-123"
            )

            assert not groups_updated

            # w permissions
            groups_updated = sync_group_assignee_inbound(
                integration, user_w_access.email, "APP-123"
            )

            assert groups_updated[0] == group
            assert GroupAssignee.objects.filter(
                project=group.project, group=group, user_id=user_w_access.id, team__isnull=True
            ).exists()

            # confirm capitalization doesn't affect syncing
            groups_updated = sync_group_assignee_inbound(
                integration, user_w_access.email.title(), "APP-123"
            )

            assert groups_updated[0] == group
            assert GroupAssignee.objects.filter(
                project=group.project, group=group, user_id=user_w_access.id, team__isnull=True
            ).exists()

    def test_assignee_sync_inbound_deassign(self):
        group = self.group
        integration = self.create_integration(
            organization=group.organization,
            external_id="123456",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        GroupAssignee.objects.assign(group, self.user)

        with self.feature("organizations:integrations-issue-sync"):
            groups_updated = sync_group_assignee_inbound(
                integration, self.user.email, "APP-123", assign=False
            )

            assert groups_updated[0] == group
            assert not GroupAssignee.objects.filter(
                project=group.project, group=group, user_id=self.user.id, team__isnull=True
            ).exists()
