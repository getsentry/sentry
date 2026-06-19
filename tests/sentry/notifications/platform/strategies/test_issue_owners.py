from unittest import mock

from sentry.notifications.platform.strategies.issue_owners import (
    IssueOwnersNotificationStrategy,
)
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.notifications.types import FallthroughChoiceType
from sentry.testutils.cases import TestCase
from sentry.types.actor import Actor


class TestIssueOwnersNotificationStrategy(TestCase):
    @mock.patch(
        "sentry.notifications.platform.strategies.issue_owners.determine_eligible_recipients"
    )
    def test_get_targets_deduplicates_users_and_teams(
        self, mock_recipients: mock.MagicMock
    ) -> None:
        team = self.create_team(organization=self.organization)
        self.create_team_membership(team=team, user=self.user)
        other_user = self.create_user(email="another@example.com")
        self.create_team_membership(team=team, user=other_user)
        mock_recipients.return_value = [
            Actor.from_orm_user(self.user),
            Actor.from_orm_team(team),
        ]

        strategy = IssueOwnersNotificationStrategy(
            project=self.project,
            fallthrough_choice=FallthroughChoiceType.ACTIVE_MEMBERS,
        )

        targets = strategy.get_targets()
        for target in targets:
            assert isinstance(target, GenericNotificationTarget)
            assert target.provider_key == NotificationProviderKey.EMAIL
            assert target.resource_type == NotificationTargetResourceType.EMAIL

        emails = [t.resource_id for t in targets]
        assert emails.count(self.user.email) == 1
        assert emails.count("another@example.com") == 1

    @mock.patch(
        "sentry.notifications.platform.strategies.issue_owners.determine_eligible_recipients"
    )
    def test_get_targets_empty_when_no_recipients(self, mock_recipients: mock.MagicMock) -> None:
        mock_recipients.return_value = []

        strategy = IssueOwnersNotificationStrategy(
            project=self.project,
            fallthrough_choice=FallthroughChoiceType.NO_ONE,
        )

        assert strategy.get_targets() == []
