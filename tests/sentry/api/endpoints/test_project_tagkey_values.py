from __future__ import absolute_import

from datetime import timedelta

from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.testutils import (
    APITestCase,
    SnubaTestCase,
)


class ProjectTagKeyValuesTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        key = 'foo'
        value = 'bar'
        project = self.create_project()
        self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
                'tags': {key: value}
            },
            project_id=project.id,
        )

        self.login_as(user=self.user)
        url = reverse(
            'sentry-api-0-project-tagkey-values',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'key': key,
            }
        )

        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['value'] == value

    def test_query(self):
        project = self.create_project()
        key = 'foo'
        value = 'bar'
        self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
                'tags': {key: value}
            },
            project_id=project.id,
        )

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-tagkey-values',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'key': key,
            }
        )
        response = self.client.get(url + '?query=%s' % value)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]['value'] == 'bar'

        response = self.client.get(url + '?query=%s' % key)

        assert response.status_code == 200
        assert len(response.data) == 0
