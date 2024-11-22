from unittest import mock

import pytest

from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.sync import sync_group_assignee_inbound
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of, region_silo_test
from sentry.users.models import User, UserEmail
from sentry.users.services.user import RpcUser
from sentry.users.services.user.serial import serialize_rpc_user


@region_silo_test
class TestSyncAssigneeInbound(TestCase):
    def setUp(self):
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

    def create_example_integration(self, organization, external_id):
        self.example_integration = self.create_integration(
            organization=organization,
            external_id=external_id,
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

    def assign_default_group_to_user(self, user: User, group: Group | None = None):
        group_to_update: Group = group or self.group
        GroupAssignee.objects.assign(group_to_update, serialize_rpc_user(user))
        group_to_update.refresh_from_db()
        group_assignee = group_to_update.get_assignee()
        assert group_assignee is not None and group_assignee.id == user.id

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_no_affected_groups(self, mock_record_event):
        self.assign_default_group_to_user(self.test_user)

        sync_group_assignee_inbound(
            integration=self.example_integration,
            email="foo@example.com",
            external_issue_key="this-does-not-exist",
            assign=True,
        )

        mock_record_event.record_event(EventLifecycleOutcome.SUCCESS)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unassign(self, mock_record_event):
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
        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assignment(self, mock_record_event):
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
        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assign_with_multiple_groups(self, mock_record_event):
        # Create a couple new test unassigned test groups
        groups_to_assign: list[Group] = []
        for i in range(2):
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

        mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    def test_assign_with_no_user_found(self, mock_record_halt):
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
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    @mock.patch("sentry.models.groupassignee.GroupAssigneeManager.assign")
    def test_assignment_fails(self, mock_group_assign, mock_record_failure):
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

        mock_record_failure.assert_called_once_with(mock.ANY)

        exception_param = mock_record_failure.call_args_list[0].args[0]

        assert isinstance(exception_param, Exception)
        assert exception_param.args[0] == "oops, something went wrong"
