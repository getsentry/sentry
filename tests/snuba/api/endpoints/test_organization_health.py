from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from datetime import timedelta
from django.utils import timezone
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationHealthTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationHealthTest, self).setUp()
        self.min_ago = timezone.now() - timedelta(minutes=1)
        self.day_ago = timezone.now() - timedelta(days=1)

    def test_time_range(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        self.create_event('a' * 32, group=group, datetime=self.min_ago,
                          tags=[('sentry:user', 'id:%s' % (self.user.id,))])
        self.create_event('b' * 32, group=group2, datetime=self.day_ago,
                          tags=[('sentry:user', 'id:%s' % (self.user.id,))])

        now = timezone.now()

        base_url = reverse(
            'sentry-api-0-organization-health-graph',
            kwargs={
                'organization_slug': project.organization.slug,
            }
        )

        # test swapped order of start/end
        url = '%s?%s' % (base_url, urlencode({
            'end': (now - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S'),
            'start': now.strftime('%Y-%m-%dT%H:%M:%S'),
            'tag': 'user',
        }))
        response = self.client.get(url, format='json')
        assert response.status_code == 400

        url = '%s?%s' % (base_url, urlencode({
            'start': (now - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S'),
            'end': now.strftime('%Y-%m-%dT%H:%M:%S'),
            'tag': 'user',
        }))
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['totals']['count'] == 1
