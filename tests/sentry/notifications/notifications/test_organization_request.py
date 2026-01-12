from unittest import mock

from django.db.models.query import QuerySet

from sentry.hybridcloud.rpc.service import RpcRemoteException
from sentry.integrations.types import ExternalProviders
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.notifications.strategies.role_based_recipient_strategy import (
    RoleBasedRecipientStrategy,
)
from sentry.testutils.cases import TestCase
from sentry.types.actor import Actor


class DummyRoleBasedRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self) -> QuerySet[OrganizationMember, OrganizationMember]:
        return OrganizationMember.objects.filter(organization=self.organization)


class DummyRequestNotification(OrganizationRequestNotification):
    metrics_key = "dummy"
    template_path = ""
    RoleBasedRecipientStrategyClass = DummyRoleBasedRecipientStrategy


class GetParticipantsTest(TestCase):
    def setUp(self) -> None:
        self.user2 = self.create_user()
        self.create_member(user=self.user2, organization=self.organization)
        self.user_actors = {Actor.from_orm_user(user) for user in (self.user, self.user2)}

    def test_default_to_slack(self) -> None:
        notification = DummyRequestNotification(self.organization, self.user)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: self.user_actors,
            ExternalProviders.SLACK: self.user_actors,
        }

    def test_turn_off_settings(self) -> None:
        notification = DummyRequestNotification(self.organization, self.user)

        assert notification.get_participants() == {
            ExternalProviders.EMAIL: self.user_actors,
            ExternalProviders.SLACK: self.user_actors,
        }


class RoleBasedRecipientStrategyTest(TestCase):
    def setUp(self) -> None:
        self.user2 = self.create_user()
        self.create_member(user=self.user2, organization=self.organization)

    def test_determine_recipients_handles_rpc_timeout(self) -> None:
        """Test that RPC timeouts are handled gracefully."""
        strategy = DummyRoleBasedRecipientStrategy(self.organization)

        # Mock the user_service.get_many_by_id to raise an RpcRemoteException
        with mock.patch(
            "sentry.notifications.notifications.strategies.role_based_recipient_strategy.user_service.get_many_by_id",
            side_effect=RpcRemoteException("user", "get_many", "Timeout of 10.0 exceeded"),
        ) as mock_get_many:
            with mock.patch(
                "sentry.notifications.notifications.strategies.role_based_recipient_strategy.logger"
            ) as mock_logger:
                # Should return empty list instead of raising exception
                recipients = strategy.determine_recipients()

                # Verify that it returns an empty list
                assert recipients == []

                # Verify that the RPC call was attempted
                assert mock_get_many.called

                # Verify that the error was logged
                assert mock_logger.exception.called
                log_call = mock_logger.exception.call_args
                assert log_call[0][0] == "role_based_recipient_strategy.rpc_timeout"
                assert log_call[1]["extra"]["organization_id"] == self.organization.id

    def test_determine_recipients_success(self) -> None:
        """Test that determine_recipients works normally when RPC succeeds."""
        strategy = DummyRoleBasedRecipientStrategy(self.organization)

        # Should not raise an exception and should return users
        recipients = strategy.determine_recipients()

        # Verify that we got users back
        assert len(recipients) == 2
        user_ids = {r.id for r in recipients}
        assert self.user.id in user_ids
        assert self.user2.id in user_ids
