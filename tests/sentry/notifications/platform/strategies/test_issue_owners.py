from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwnerType
from sentry.notifications.platform.strategies.issue_owners import (
    IssueOwnersActivityAlertStrategy,
)
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase


class TestIssueOwnersActivityAlertStrategy(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def test_assignee_user_returns_single_target(self) -> None:
        GroupAssignee.objects.assign(self.group, self.user)

        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        targets = strategy.get_targets()

        assert len(targets) == 1
        assert targets[0].resource_id == self.user.email

    def test_assignee_team_resolves_to_member_emails(self) -> None:
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")
        team = self.create_team(organization=self.organization)
        self.create_team_membership(team=team, user=user_a)
        self.create_team_membership(team=team, user=user_b)
        GroupAssignee.objects.assign(self.group, assigned_to=team)

        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        targets = strategy.get_targets()

        emails = {t.resource_id for t in targets}
        assert "a@example.com" in emails
        assert "b@example.com" in emails

    def test_assignee_takes_precedence_over_owners(self) -> None:
        other_user = self.create_user(email="owner@example.com")
        self.create_member(organization=self.organization, user=other_user)
        self.create_group_owner(
            group=self.group,
            user_id=other_user.id,
        )
        GroupAssignee.objects.assign(self.group, self.user)

        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        targets = strategy.get_targets()

        emails = {t.resource_id for t in targets}
        assert self.user.email in emails
        assert "owner@example.com" not in emails

    def test_owners_used_when_no_assignee(self) -> None:
        other_user = self.create_user(email="owner@example.com")
        self.create_member(organization=self.organization, user=other_user)
        self.create_group_owner(
            group=self.group,
            user_id=other_user.id,
        )

        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        targets = strategy.get_targets()

        assert len(targets) == 1
        assert targets[0].resource_id == "owner@example.com"

    def test_multiple_owners_all_notified(self) -> None:
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")
        self.create_member(organization=self.organization, user=user_a)
        self.create_member(organization=self.organization, user=user_b)
        for u in (user_a, user_b):
            self.create_group_owner(
                group=self.group,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
                user_id=u.id,
            )

        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        targets = strategy.get_targets()

        emails = {t.resource_id for t in targets}
        assert "a@example.com" in emails
        assert "b@example.com" in emails

    def test_team_owner_resolves_to_members(self) -> None:
        team_user = self.create_user(email="team-member@example.com")
        team = self.create_team(organization=self.organization)
        self.create_team_membership(team=team, user=team_user)
        self.create_group_owner(
            group=self.group,
            type=GroupOwnerType.CODEOWNERS.value,
            team=team,
        )

        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        targets = strategy.get_targets()

        emails = {t.resource_id for t in targets}
        assert "team-member@example.com" in emails

    def test_deduplicates_across_owner_types(self) -> None:
        self.create_group_owner(
            group=self.group,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
        )
        self.create_group_owner(
            group=self.group,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            user_id=self.user.id,
        )

        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        targets = strategy.get_targets()

        emails = [t.resource_id for t in targets]
        assert emails.count(self.user.email) == 1

    def test_seer_suggested_owner_notified_when_no_assignee(self) -> None:
        seer_user = self.create_user(email="seer-pick@example.com")
        self.create_member(organization=self.organization, user=seer_user)
        self.create_group_owner(
            group=self.group,
            type=GroupOwnerType.SEER_SUGGESTED.value,
            user_id=seer_user.id,
        )

        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        targets = strategy.get_targets()

        assert len(targets) == 1
        assert targets[0].resource_id == "seer-pick@example.com"

    def test_assignee_supersedes_seer_suggested_owner(self) -> None:
        seer_user = self.create_user(email="seer-pick@example.com")
        self.create_member(organization=self.organization, user=seer_user)
        self.create_group_owner(
            group=self.group,
            type=GroupOwnerType.SEER_SUGGESTED.value,
            user_id=seer_user.id,
        )
        GroupAssignee.objects.assign(self.group, self.user)

        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        targets = strategy.get_targets()

        emails = {t.resource_id for t in targets}
        assert self.user.email in emails
        assert "seer-pick@example.com" not in emails

    def test_no_assignee_no_owners_returns_empty(self) -> None:
        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        assert strategy.get_targets() == []

    def test_all_targets_are_email_type(self) -> None:
        GroupAssignee.objects.assign(self.group, self.user)

        strategy = IssueOwnersActivityAlertStrategy(group=self.group)
        targets = strategy.get_targets()

        for target in targets:
            assert isinstance(target, GenericNotificationTarget)
            assert target.provider_key == NotificationProviderKey.EMAIL
            assert target.resource_type == NotificationTargetResourceType.EMAIL
