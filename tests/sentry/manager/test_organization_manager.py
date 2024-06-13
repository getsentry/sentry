from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase


class OrganizationManagerTest(TestCase):
    def test_get_for_user_ids(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        self.create_team_membership(team, user=user)

        orgs = Organization.objects.get_for_user_ids({user.id})
        assert list(orgs) == [org]
