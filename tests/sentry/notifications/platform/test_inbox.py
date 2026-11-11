from sentry.inbox.issue import ISSUE_USER_MENTIONED, IssueMentionedData
from sentry.inbox.types import SYSTEM_ACTOR, InboxActor
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.notifications.models.inboxitemevent import InboxItemEvent
from sentry.notifications.platform.inbox import create_inbox_items
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.actor import Actor


@with_feature("organizations:universal-inbox-recording")
class CreateInboxItemsTest(TestCase):
    def _create(self, recipients: list[Actor], actor: InboxActor = SYSTEM_ACTOR) -> None:
        create_inbox_items(
            event_type=ISSUE_USER_MENTIONED,
            subject=self.group,
            data=IssueMentionedData(summary="Mentioned you in a comment", comment_id=123),
            recipients=recipients,
            actor=actor,
        )

    def _recorded_user_ids(self) -> list[int]:
        return sorted(InboxItemEvent.objects.values_list("inbox_item__user_id", flat=True))

    def test_records_for_users(self) -> None:
        other = self.create_user()
        self.create_member(organization=self.organization, user=other)

        self._create([Actor.from_object(self.user), Actor.from_object(other)])

        assert self._recorded_user_ids() == sorted([self.user.id, other.id])

    def test_expands_teams_to_active_members(self) -> None:
        team = self.create_team(organization=self.organization)
        member = self.create_user()
        inactive_member = self.create_user()
        self.create_member(organization=self.organization, user=member, teams=[team])
        self.create_member(organization=self.organization, user=inactive_member, teams=[team])
        OrganizationMemberTeam.objects.filter(
            team=team, organizationmember__user_id=inactive_member.id
        ).update(is_active=False)

        self._create([Actor.from_object(team)])

        assert self._recorded_user_ids() == [member.id]

    def test_user_reached_directly_and_through_team_gets_one_event(self) -> None:
        team = self.create_team(organization=self.organization, members=[self.user])

        self._create([Actor.from_object(self.user), Actor.from_object(team)])

        assert self._recorded_user_ids() == [self.user.id]

    def test_drops_recipients_outside_organization(self) -> None:
        other_organization = self.create_organization()
        outsider = self.create_user()
        other_team = self.create_team(organization=other_organization)
        self.create_member(organization=other_organization, user=outsider, teams=[other_team])

        self._create([Actor.from_object(outsider), Actor.from_object(other_team)])

        assert not InboxItemEvent.objects.exists()

    def test_excludes_actor(self) -> None:
        self._create([Actor.from_object(self.user)], actor=InboxActor.user(self.user.id))

        assert not InboxItemEvent.objects.exists()
