from collections.abc import Sequence
from unittest.mock import patch

from sentry.inbox.issue import ISSUE, ISSUE_USER_MENTIONED, IssueMentionedData
from sentry.inbox.types import SYSTEM_ACTOR, InboxActor
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.notifications.platform.inbox import create_inbox_items
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class CreateInboxItemsTest(TestCase):
    def _create(
        self,
        *,
        user_ids: Sequence[int] = (),
        team_ids: Sequence[int] = (),
        actor: InboxActor = SYSTEM_ACTOR,
    ) -> None:
        create_inbox_items(
            event_type=ISSUE_USER_MENTIONED,
            subject=self.group,
            data=IssueMentionedData(comment_id=123),
            user_ids=user_ids,
            team_ids=team_ids,
            actor=actor,
        )

    def _recorded_user_ids(self) -> list[int]:
        return sorted(InboxItemEvent.objects.values_list("inbox_item__user_id", flat=True))

    def test_records_nothing_when_recording_disabled(self) -> None:
        self._create(user_ids=[self.user.id])

        assert not InboxItemEvent.objects.exists()

    @with_feature("organizations:universal-inbox-recording")
    def test_records_for_users(self) -> None:
        other = self.create_user()
        self.create_member(organization=self.organization, user=other)

        self._create(user_ids=[self.user.id, other.id])

        assert self._recorded_user_ids() == sorted([self.user.id, other.id])

    @with_feature("organizations:universal-inbox-recording")
    def test_expands_teams_to_active_members(self) -> None:
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        inactive_member = self.create_user()
        self.create_member(organization=self.organization, user=member, teams=[team])
        self.create_member(organization=self.organization, user=inactive_member, teams=[team])
        OrganizationMemberTeam.objects.filter(
            team=team, organizationmember__user_id=inactive_member.id
        ).update(is_active=False)

        self._create(team_ids=[team.id])

        assert self._recorded_user_ids() == [member.id]

    @with_feature("organizations:universal-inbox-recording")
    def test_user_reached_directly_and_through_team_gets_one_event(self) -> None:
        team = self.create_team(organization=self.organization, members=[self.user])

        self._create(user_ids=[self.user.id], team_ids=[team.id])

        assert self._recorded_user_ids() == [self.user.id]

    @with_feature("organizations:universal-inbox-recording")
    def test_drops_recipients_outside_organization(self) -> None:
        other_organization = self.create_organization()
        outsider = self.create_user()
        other_team = self.create_team(organization=other_organization)
        self.create_member(organization=other_organization, user=outsider, teams=[other_team])

        self._create(user_ids=[outsider.id], team_ids=[other_team.id])

        assert not InboxItemEvent.objects.exists()

    @with_feature("organizations:universal-inbox-recording")
    def test_drops_recipients_the_item_type_filters_out(self) -> None:
        other = self.create_user()
        self.create_member(organization=self.organization, user=other)

        with patch.object(
            ISSUE, "filter_recipients", return_value=[other.id], autospec=True
        ) as filter_recipients:
            self._create(user_ids=[self.user.id, other.id])

        assert self._recorded_user_ids() == [other.id]
        assert filter_recipients.call_args.kwargs["subject"] == self.group
        assert sorted(filter_recipients.call_args.kwargs["user_ids"]) == sorted(
            [self.user.id, other.id]
        )

    @with_feature("organizations:universal-inbox-recording")
    def test_excludes_actor(self) -> None:
        self._create(user_ids=[self.user.id], actor=InboxActor.user(self.user.id))

        assert not InboxItemEvent.objects.exists()
