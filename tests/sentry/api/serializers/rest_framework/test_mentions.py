from sentry.api.serializers.rest_framework.mentions import extract_user_ids_from_mentions
from sentry.models import ActorTuple, Team, User
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ExtractUserIdsFromMentionsTest(TestCase):
    def test_users(self):
        actor = ActorTuple(self.user.id, User)
        result = extract_user_ids_from_mentions(self.organization.id, [actor])
        assert result["users"] == {self.user.id}
        assert result["team_users"] == set()

        other_user = self.create_user()
        result = extract_user_ids_from_mentions(
            self.organization.id, [actor, ActorTuple(other_user.id, User)]
        )
        assert result["users"] == {self.user.id, other_user.id}
        assert result["team_users"] == set()

    def test_teams(self):
        member_user = self.create_user()
        self.create_member(
            user=member_user, organization=self.organization, role="member", teams=[self.team]
        )
        actor = ActorTuple(self.team.id, Team)
        result = extract_user_ids_from_mentions(self.organization.id, [actor])
        assert result["users"] == set()
        assert result["team_users"] == {self.user.id, member_user.id}

        # Explicitly mentioned users shouldn't be included in team_users
        result = extract_user_ids_from_mentions(
            self.organization.id, [ActorTuple(member_user.id, User), actor]
        )
        assert result["users"] == {member_user.id}
        assert result["team_users"] == {self.user.id}
