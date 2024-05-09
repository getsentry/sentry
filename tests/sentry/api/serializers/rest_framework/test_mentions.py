from sentry.api.serializers.rest_framework.mentions import extract_user_ids_from_mentions
from sentry.testutils.cases import TestCase
from sentry.types.actor import Actor


class ExtractUserIdsFromMentionsTest(TestCase):
    def test_users(self):
        actor = Actor.from_id(user_id=self.user.id)
        result = extract_user_ids_from_mentions(self.organization.id, [actor])
        assert result["users"] == {self.user.id}
        assert result["team_users"] == set()
        assert result["teams"] == set()

        other_user = self.create_user()
        result = extract_user_ids_from_mentions(
            self.organization.id, [actor, Actor.from_id(user_id=other_user.id)]
        )
        assert result["users"] == {self.user.id, other_user.id}
        assert result["team_users"] == set()
        assert result["teams"] == set()

    def test_teams(self):
        member_user = self.create_user()
        not_team_member = self.create_user()
        self.create_member(
            user=member_user, organization=self.organization, role="member", teams=[self.team]
        )
        self.create_member(
            user=not_team_member, organization=self.organization, role="member", teams=[]
        )
        actor = Actor.from_id(team_id=self.team.id)
        result = extract_user_ids_from_mentions(self.organization.id, [actor])
        assert result["users"] == set()
        assert result["team_users"] == {self.user.id, member_user.id}
        assert result["teams"] == {self.team.id}

        # Explicitly mentioned users shouldn't be included in team_users
        result = extract_user_ids_from_mentions(
            self.organization.id, [Actor.from_id(user_id=member_user.id), actor]
        )
        assert result["users"] == {member_user.id}
        assert result["team_users"] == {self.user.id}
        assert result["teams"] == {self.team.id}
