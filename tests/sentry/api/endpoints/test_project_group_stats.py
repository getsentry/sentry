from __future__ import absolute_import

import six

from sentry.app import tsdb
from sentry.testutils import APITestCase


class ProjectGroupStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group1 = self.create_group(project=project)
        group2 = self.create_group(project=project)

        url = '/api/0/projects/{}/{}/issues/stats/'.format(
            project.organization.slug,
            project.slug,
        )
        response = self.client.get('%s?id=%s&id=%s' % (url, group1.id, group2.id),
                                   format='json')

        tsdb.incr(tsdb.models.group, group1.id, count=3)

        response = self.client.get('%s?id=%s&id=%s' % (url, group1.id, group2.id),
                                   format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert six.text_type(group1.id) in response.data
        assert six.text_type(group2.id) in response.data

        group_data = response.data[six.text_type(group1.id)]
        assert group_data[-1][1] == 3, response.data
        for point in group_data[:-1]:
            assert point[1] == 0
        assert len(group_data) == 24
