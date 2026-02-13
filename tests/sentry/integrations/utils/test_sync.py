from unittest import mock

import pytest

from sentry.integrations.types import EventLifecycleOutcome, ExternalProviders
from sentry.integrations.utils.sync import (
    AssigneeInboundSyncMethod,
    sync_group_assignee_inbound,
    sync_group_assignee_inbound_by_external_actor,
)
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode_of, region_silo_test
from sentry.users.models import User, UserEmail
from sentry.users.services.user import RpcUser
from sentry.users.services.user.serial import serialize_rpc_user


@region_silo_test
class TestSyncAssigneeInbound(TestCase):
    def setUp(self) -> None:
        self.example_integration = self.create_integration(
            organization=self.group.organization,
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
        self.test_user = self.create_user("test@example.com")
        self.create_member(organization=self.organization, user=self.test_user, teams=[self.team])

        with assume_test_silo_mode_of(UserEmail):
            UserEmail.objects.filter(user=self.test_user).update(is_verified=True)
            assert UserEmail.objects.filter(
                user=self.test_user, email="test@example.com", is_verified=True
            ).exists()

    def assign_default_group_to_user(self, user: User, group: Group | None = None):
        group_to_update: Group = group or self.group
        GroupAssignee.objects.assign(group_to_update, serialize_rpc_user(user))
        group_to_update.refresh_from_db()
        group_assignee = group_to_update.get_assignee()
        assert group_assignee is not None and group_assignee.id == user.id

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_no_affected_groups(self, mock_record_event: mock.MagicMock) -> None:
        self.assign_default_group_to_user(self.test_user)

        sync_group_assignee_inbound(
            integration=self.example_integration,
            email="foo@example.com",
            external_issue_key="this-does-not-exist",
            assign=True,
        )

        mock_record_event.record_event(EventLifecycleOutcome.SUCCESS)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unassign(self, mock_record_event: mock.MagicMock) -> None:
        self.assign_default_group_to_user(self.test_user)
        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-123",
            integration=self.example_integration,
        )

        sync_group_assignee_inbound(
            integration=self.example_integration,
            email="test@example.com",
            external_issue_key=external_issue.key,
            assign=False,
        )

        assert self.group.get_assignee() is None
        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assignment(self, mock_record_event: mock.MagicMock) -> None:
        assert self.group.get_assignee() is None

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-123",
            integration=self.example_integration,
        )

        sync_group_assignee_inbound(
            integration=self.example_integration,
            email="test@example.com",
            external_issue_key=external_issue.key,
            assign=True,
        )

        updated_assignee = self.group.get_assignee()
        assert updated_assignee is not None
        assert updated_assignee.id == self.test_user.id
        assert updated_assignee.email == "test@example.com"
        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assign_with_multiple_groups(self, mock_record_event: mock.MagicMock) -> None:
        # Create a couple new test unassigned test groups
        groups_to_assign: list[Group] = []
        for _ in range(2):
            org = self.create_organization(owner=self.create_user())
            team = self.create_team(organization=org)
            project = self.create_project(organization=org, teams=[team])
            self.create_member(organization=org, user=self.test_user, teams=[team])
            self.create_organization_integration(
                organization_id=org.id,
                integration=self.example_integration,
                config={
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                },
            )

            groups_to_assign.append(
                self.create_group(project=project),
            )

        external_issue_key = "foo-123"
        for group in groups_to_assign:
            assert group.get_assignee() is None
            self.create_integration_external_issue(
                group=group,
                key="foo-123",
                integration=self.example_integration,
            )

        sync_group_assignee_inbound(
            integration=self.example_integration,
            email="test@example.com",
            external_issue_key=external_issue_key,
            assign=True,
        )

        for group in groups_to_assign:
            assignee = group.get_assignee()
            assert assignee is not None
            assert isinstance(assignee, RpcUser)
            assert assignee.id == self.test_user.id
            assert assignee.email == "test@example.com"

        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    def test_assign_with_no_user_found(self, mock_record_halt: mock.MagicMock) -> None:
        assert self.group.get_assignee() is None

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-123",
            integration=self.example_integration,
        )

        sync_group_assignee_inbound(
            integration=self.example_integration,
            email="oopsnotfound@example.com",
            external_issue_key=external_issue.key,
            assign=True,
        )

        updated_assignee = self.group.get_assignee()
        assert updated_assignee is None
        mock_record_halt.assert_called_with(
            "inbound-assignee-not-found",
            extra={
                "integration_id": self.example_integration.id,
                "email": "oopsnotfound@example.com",
                "issue_key": external_issue.key,
                "method": AssigneeInboundSyncMethod.EMAIL.value,
                "assign": True,
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    @mock.patch("sentry.models.groupassignee.GroupAssigneeManager.assign")
    def test_assignment_fails(
        self, mock_group_assign: mock.MagicMock, mock_record_failure: mock.MagicMock
    ) -> None:
        def raise_exception(*args, **kwargs):
            raise Exception("oops, something went wrong")

        assert self.group.get_assignee() is None

        mock_group_assign.side_effect = raise_exception

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="foo-123",
            integration=self.example_integration,
        )

        with pytest.raises(Exception) as exc:
            sync_group_assignee_inbound(
                integration=self.example_integration,
                email="test@example.com",
                external_issue_key=external_issue.key,
                assign=True,
            )

        assert exc.match("oops, something went wrong")

        updated_assignee = self.group.get_assignee()
        assert updated_assignee is None

        mock_record_failure.assert_called_once_with(mock.ANY, create_issue=True)

        exception_param = mock_record_failure.call_args_list[0].args[0]

        assert isinstance(exception_param, Exception)
        assert exception_param.args[0] == "oops, something went wrong"


@region_silo_test
@with_feature("organizations:integrations-github-project-management")
class TestSyncAssigneeInboundByExternalActor(TestCase):
    @pytest.fixture(autouse=True)
    def mock_where_should_sync(self):
        with mock.patch(
            "sentry.integrations.utils.sync.where_should_sync"
        ) as mock_where_should_sync:
            mock_where_should_sync.return_value = [self.organization]
            yield mock_where_should_sync

    def setUp(self) -> None:
        self.example_integration = self.create_integration(
            organization=self.group.organization,
            external_id="123456",
            provider="github",
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
        self.test_user = self.create_user("test@example.com")
        self.create_member(organization=self.organization, user=self.test_user, teams=[self.team])

        with assume_test_silo_mode_of(UserEmail):
            UserEmail.objects.filter(user=self.test_user).update(is_verified=True)
            assert UserEmail.objects.filter(
                user=self.test_user, email="test@example.com", is_verified=True
            ).exists()

    def assign_default_group_to_user(self, user: User, group: Group | None = None):
        group_to_update: Group = group or self.group
        GroupAssignee.objects.assign(group_to_update, serialize_rpc_user(user))
        group_to_update.refresh_from_db()
        group_assignee = group_to_update.get_assignee()
        assert group_assignee is not None and group_assignee.id == user.id

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_no_affected_groups(self, mock_record_event: mock.MagicMock) -> None:
        """Test when no groups are affected by the external issue."""
        self.assign_default_group_to_user(self.test_user)

        sync_group_assignee_inbound_by_external_actor(
            integration=self.example_integration,
            external_user_name="johndoe",
            external_issue_key="this-does-not-exist",
            assign=True,
        )

        mock_record_event.record_event(EventLifecycleOutcome.SUCCESS)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unassign(self, mock_record_event: mock.MagicMock) -> None:
        """Test unassigning a group via external actor."""
        self.assign_default_group_to_user(self.test_user)
        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="JIRA-123",
            integration=self.example_integration,
        )

        # Create external user mapping
        self.create_external_user(
            user=self.test_user,
            external_name="johndoe",
            provider=ExternalProviders.GITHUB.value,
            integration=self.example_integration,
        )

        sync_group_assignee_inbound_by_external_actor(
            integration=self.example_integration,
            external_user_name="johndoe",
            external_issue_key=external_issue.key,
            assign=False,
        )

        assert self.group.get_assignee() is None
        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assignment_with_external_actor(
        self,
        mock_record_event: mock.MagicMock,
    ) -> None:
        """Test assigning a group to a user via external actor."""
        assert self.group.get_assignee() is None

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="JIRA-123",
            integration=self.example_integration,
        )

        # Create external user mapping
        self.create_external_user(
            user=self.test_user,
            external_name="johndoe",
            provider=ExternalProviders.GITHUB.value,
            integration=self.example_integration,
        )

        sync_group_assignee_inbound_by_external_actor(
            integration=self.example_integration,
            external_user_name="johndoe",
            external_issue_key=external_issue.key,
            assign=True,
        )

        updated_assignee = self.group.get_assignee()
        assert updated_assignee is not None
        assert updated_assignee.id == self.test_user.id
        assert updated_assignee.email == "test@example.com"
        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assignment_with_external_actor_case_insensitive(
        self,
        mock_record_event: mock.MagicMock,
    ) -> None:
        """Test assigning a group to a user via external actor."""
        assert self.group.get_assignee() is None

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="JIRA-123",
            integration=self.example_integration,
        )

        # Create external user mapping
        self.create_external_user(
            user=self.test_user,
            external_name="@JohnDoe",
            provider=ExternalProviders.GITHUB.value,
            integration=self.example_integration,
        )

        sync_group_assignee_inbound_by_external_actor(
            integration=self.example_integration,
            external_user_name="@johndoe",
            external_issue_key=external_issue.key,
            assign=True,
        )

        updated_assignee = self.group.get_assignee()
        assert updated_assignee is not None
        assert updated_assignee.id == self.test_user.id
        assert updated_assignee.email == "test@example.com"
        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch("sentry.integrations.utils.sync.where_should_sync")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assign_with_multiple_groups(
        self, mock_record_event: mock.MagicMock, mock_where_should_sync: mock.MagicMock
    ) -> None:
        """Test assigning multiple groups via external actor."""
        # Create a couple new test unassigned test groups
        groups_to_assign: list[Group] = []
        orgs_to_assign: list[Organization] = []
        for _ in range(2):
            org = self.create_organization(owner=self.create_user())
            team = self.create_team(organization=org)
            project = self.create_project(organization=org, teams=[team])
            self.create_member(organization=org, user=self.test_user, teams=[team])
            self.create_organization_integration(
                organization_id=org.id,
                integration=self.example_integration,
                config={"sync_reverse_assignment": True},
            )

            groups_to_assign.append(
                self.create_group(project=project),
            )
            orgs_to_assign.append(org)

        mock_where_should_sync.return_value = orgs_to_assign

        external_issue_key = "JIRA-456"
        for group in groups_to_assign:
            assert group.get_assignee() is None
            self.create_integration_external_issue(
                group=group,
                key=external_issue_key,
                integration=self.example_integration,
            )

        # Create external user mapping
        self.create_external_user(
            user=self.test_user,
            external_name="johndoe",
            provider=ExternalProviders.GITHUB.value,
            integration=self.example_integration,
        )

        sync_group_assignee_inbound_by_external_actor(
            integration=self.example_integration,
            external_user_name="johndoe",
            external_issue_key=external_issue_key,
            assign=True,
        )

        for group in groups_to_assign:
            assignee = group.get_assignee()
            assert assignee is not None
            assert isinstance(assignee, RpcUser)
            assert assignee.id == self.test_user.id
            assert assignee.email == "test@example.com"

        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    def test_assign_with_no_external_actor_found(self, mock_record_halt: mock.MagicMock) -> None:
        """Test assignment when no external actor mapping exists."""
        assert self.group.get_assignee() is None

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="JIRA-789",
            integration=self.example_integration,
        )

        # Don't create any external user mapping - this should cause a halt

        sync_group_assignee_inbound_by_external_actor(
            integration=self.example_integration,
            external_user_name="unknownuser",
            external_issue_key=external_issue.key,
            assign=True,
        )

        updated_assignee = self.group.get_assignee()
        assert updated_assignee is None
        mock_record_halt.assert_called_with(
            "inbound-assignee-not-found",
            extra={
                "integration_id": self.example_integration.id,
                "external_user_name": "unknownuser",
                "issue_key": external_issue.key,
                "method": AssigneeInboundSyncMethod.EXTERNAL_ACTOR.value,
                "assign": True,
                "user_ids": [],
                "groups_assigned_count": 0,
                "affected_groups_count": 1,
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    def test_assign_with_user_not_in_project(self, mock_record_halt: mock.MagicMock) -> None:
        """Test assignment when user exists but is not a member of the project."""
        assert self.group.get_assignee() is None

        # Create a user that is not a member of the project
        other_user = self.create_user("other@example.com")

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="JIRA-999",
            integration=self.example_integration,
        )

        # Create external user mapping for the user who is not in the project
        self.create_external_user(
            user=other_user,
            external_name="outsider",
            provider=ExternalProviders.GITHUB.value,
            integration=self.example_integration,
        )

        sync_group_assignee_inbound_by_external_actor(
            integration=self.example_integration,
            external_user_name="outsider",
            external_issue_key=external_issue.key,
            assign=True,
        )

        updated_assignee = self.group.get_assignee()
        assert updated_assignee is None
        mock_record_halt.assert_called_with(
            "inbound-assignee-not-found",
            extra={
                "integration_id": self.example_integration.id,
                "external_user_name": "outsider",
                "issue_key": external_issue.key,
                "method": AssigneeInboundSyncMethod.EXTERNAL_ACTOR.value,
                "assign": True,
                "user_ids": [other_user.id],
                "groups_assigned_count": 0,
                "affected_groups_count": 1,
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    @mock.patch("sentry.models.groupassignee.GroupAssigneeManager.assign")
    def test_assignment_fails(
        self,
        mock_group_assign: mock.MagicMock,
        mock_record_failure: mock.MagicMock,
    ) -> None:
        """Test handling when assignment operation fails."""

        def raise_exception(*_args, **_kwargs):
            raise Exception("oops, something went wrong during assignment")

        assert self.group.get_assignee() is None

        mock_group_assign.side_effect = raise_exception

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="JIRA-ERROR",
            integration=self.example_integration,
        )

        # Create external user mapping
        self.create_external_user(
            user=self.test_user,
            external_name="johndoe",
            provider=ExternalProviders.GITHUB.value,
            integration=self.example_integration,
        )

        with pytest.raises(Exception) as exc:
            sync_group_assignee_inbound_by_external_actor(
                integration=self.example_integration,
                external_user_name="johndoe",
                external_issue_key=external_issue.key,
                assign=True,
            )

        assert exc.match("oops, something went wrong during assignment")

        updated_assignee = self.group.get_assignee()
        assert updated_assignee is None

        mock_record_failure.assert_called_once_with(mock.ANY, create_issue=True)

        exception_param = mock_record_failure.call_args_list[0].args[0]

        assert isinstance(exception_param, Exception)
        assert exception_param.args[0] == "oops, something went wrong during assignment"

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_multiple_external_actors_same_name(self, mock_record_event: mock.MagicMock) -> None:
        """Test assignment when multiple users have the same external name (should use the first one found)."""
        assert self.group.get_assignee() is None

        # Create another user
        another_user = self.create_user("another@example.com")
        self.create_member(organization=self.organization, user=another_user, teams=[self.team])

        external_issue = self.create_integration_external_issue(
            group=self.group,
            key="JIRA-DUP",
            integration=self.example_integration,
        )

        # Create external user mappings with the same external name
        self.create_external_user(
            user=self.test_user,
            external_name="duplicate_name",
            provider=ExternalProviders.GITHUB.value,
            integration=self.example_integration,
        )
        self.create_external_user(
            user=another_user,
            external_name="duplicate_name",
            provider=ExternalProviders.GITHUB.value,
            integration=self.example_integration,
        )

        sync_group_assignee_inbound_by_external_actor(
            integration=self.example_integration,
            external_user_name="duplicate_name",
            external_issue_key=external_issue.key,
            assign=True,
        )

        updated_assignee = self.group.get_assignee()
        assert updated_assignee is not None
        # The assignment should succeed with one of the users
        assert updated_assignee.id in [self.test_user.id, another_user.id]
        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

    @mock.patch("sentry.integrations.utils.sync.where_should_sync")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_same_external_name_different_users_across_orgs(
        self, mock_record_event: mock.MagicMock, mock_where_should_sync: mock.MagicMock
    ) -> None:
        """Test when the same external_user_name maps to different users in different orgs.

        Scenario 1: Both users should be assigned to their respective groups.
        Scenario 2: When only one user has a group with the external issue, only that user is affected.
        """
        # Create two different organizations
        # org1 is self.organization (already exists)
        org2 = self.create_organization(owner=self.create_user())

        mock_where_should_sync.return_value = [self.organization, org2]

        # Create two different users
        user1 = self.test_user  # Already exists in org1
        user2 = self.create_user("user2@example.com")

        # Create teams and memberships
        team2 = self.create_team(organization=org2)
        self.create_member(organization=org2, user=user2, teams=[team2])

        # Create projects and groups for each org
        project2 = self.create_project(organization=org2, teams=[team2])
        group1 = self.group  # Already exists in org1
        group2 = self.create_group(project=project2)

        # Setup organization integrations for both orgs
        self.create_organization_integration(
            organization_id=org2.id,
            integration=self.example_integration,
            config={"sync_reverse_assignment": True},
        )

        # Create external user mappings - same external name, different users in different orgs
        self.create_external_user(
            user=user1,
            external_name="shared_github_username",
            provider=ExternalProviders.GITHUB.value,
            integration=self.example_integration,
        )
        self.create_external_user(
            user=user2,
            external_name="shared_github_username",
            provider=ExternalProviders.GITHUB.value,
            integration=self.example_integration,
        )

        # Scenario 1: Both groups have the same external issue key
        external_issue_key = "SHARED-123"

        # Create external issues for both groups
        self.create_integration_external_issue(
            group=group1,
            key=external_issue_key,
            integration=self.example_integration,
        )
        self.create_integration_external_issue(
            group=group2,
            key=external_issue_key,
            integration=self.example_integration,
        )

        # Verify both groups are unassigned initially
        assert group1.get_assignee() is None
        assert group2.get_assignee() is None

        # Perform the sync
        sync_group_assignee_inbound_by_external_actor(
            integration=self.example_integration,
            external_user_name="shared_github_username",
            external_issue_key=external_issue_key,
            assign=True,
        )

        # Both groups should be assigned to their respective users
        assignee1 = group1.get_assignee()
        assert assignee1 is not None
        assert assignee1.id == user1.id
        assert assignee1.email == "test@example.com"

        assignee2 = group2.get_assignee()
        assert assignee2 is not None
        assert assignee2.id == user2.id
        assert assignee2.email == "user2@example.com"

        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None, False, None)

        # Scenario 2: Only one group has a different external issue
        group3 = self.create_group(project=self.project)
        group4 = self.create_group(project=project2)

        unique_issue_key = "UNIQUE-456"

        # Only create external issue for group3 (user1's group)
        self.create_integration_external_issue(
            group=group3,
            key=unique_issue_key,
            integration=self.example_integration,
        )
        # group4 does NOT have this external issue

        # Verify both are unassigned initially
        assert group3.get_assignee() is None
        assert group4.get_assignee() is None

        # Perform the sync with the unique issue key
        sync_group_assignee_inbound_by_external_actor(
            integration=self.example_integration,
            external_user_name="shared_github_username",
            external_issue_key=unique_issue_key,
            assign=True,
        )

        # Only group3 should be assigned (to user1)
        assignee3 = group3.get_assignee()
        assert assignee3 is not None
        assert assignee3.id == user1.id

        # group4 should remain unassigned
        assert group4.get_assignee() is None
