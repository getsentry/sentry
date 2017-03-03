from __future__ import absolute_import

import six

from sentry.testutils import APITestCase


class TeamGroupsTrendingTest(APITestCase):
    def test_simple(self):
        project1 = self.create_project(team=self.team, slug='foo')
        project2 = self.create_project(team=self.team, slug='bar')
        group1 = self.create_group(checksum='a' * 32, project=project1, score=10)
        group2 = self.create_group(checksum='b' * 32, project=project2, score=5)

        self.login_as(user=self.user)

        url = '/api/0/teams/{}/{}/issues/trending/'.format(
            self.team.organization.slug,
            self.team.slug,
        )
        response = self.client.get(url, format='json')
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['id'] == six.text_type(group1.id)
        assert response.data[1]['id'] == six.text_type(group2.id)
