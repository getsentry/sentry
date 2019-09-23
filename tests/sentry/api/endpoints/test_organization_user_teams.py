from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class OrganizationUserTeamsTest(APITestCase):
    def test_simple(self):
        foo = self.create_user("foo@example.com")
        org = self.create_organization(owner=self.user)
        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)
        self.create_team(organization=org)
        self.create_member(organization=org, user=foo, teams=[team1, team2])
        self.login_as(user=foo)
        url = reverse(
            "sentry-api-0-organization-user-teams", kwargs={"organization_slug": org.slug}
        )
        response = self.client.get(url)
        assert response.status_code == 200

        # Verify that only teams that the user is a member of, are returned
        assert len(response.data) == 2

        # Sort teams so there is a guaranteed ordering
        response.data.sort(key=lambda x: x["id"])
        assert response.data[0]["id"] == six.text_type(team1.id)
        assert response.data[0]["isMember"]
        assert response.data[1]["id"] == six.text_type(team2.id)
        assert response.data[1]["isMember"]
