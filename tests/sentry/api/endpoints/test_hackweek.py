from sentry.testutils import APITestCase


class TeamMemberIntersectTest(APITestCase):
    endpoint = "sentry-hackweek"

    def test_simple(self):
        self.login_as(self.user)
        users = [self.create_user(is_superuser=False) for _ in range(20)]
        team1 = self.create_team(self.organization)
        team2 = self.create_team(self.organization)
        [
            self.create_member(
                user=user, organization=self.organization, role="member", teams=[team1, team2]
            )
            for user in users
        ]

        resp = self.get_success_response(
            self.organization.slug, **{"teams": [team1.slug, team2.slug], "per_page": 10}
        )
        print(resp.data)
