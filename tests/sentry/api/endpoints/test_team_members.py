from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class TeamMembersTest(APITestCase):
    def test_simple(self):
        org = self.create_organization()
        team = self.create_team(organization=org)
        foo = self.create_user('foo@example.com')
        bar = self.create_user('bar@example.com')
        member = self.create_member(organization=org, user=foo, teams=[team])
        self.create_member(organization=org, user=bar, teams=[])
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-team-members', kwargs={
            'organization_slug': org.slug,
            'team_slug': team.slug,
        })
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(member.id)
