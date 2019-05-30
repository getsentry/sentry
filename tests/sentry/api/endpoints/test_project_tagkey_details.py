from __future__ import absolute_import

from datetime import timedelta

from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry import tagstore
from sentry.tagstore import TagKeyStatus
from sentry.tagstore.exceptions import TagKeyNotFound
from sentry.testutils import (
    APITestCase,
    SnubaTestCase,
)


class ProjectTagKeyDetailsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        project = self.create_project()
        key = 'foo'
        self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'timestamp': (timezone.now() - timedelta(hours=1)).isoformat()[:19],
                'tags': {key: 'bar'},
            },
            project_id=project.id,
        )

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-tagkey-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'key': key,
            }
        )

        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data['uniqueValues'] == 1


class ProjectTagKeyDeleteTest(APITestCase, SnubaTestCase):

    def test_simple(self):
        project = self.create_project()
        tag_key = 'foo'
        self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                'tags': {tag_key: 'bar'},
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
            },
            project_id=project.id,
        )

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-tagkey-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'key': tag_key,
            }
        )
        assert tagstore.get_tag_key(
            project.id,
            None,  # environment_id
            tag_key,
        ).status == TagKeyStatus.VISIBLE

        response = self.client.delete(url)

        assert response.status_code == 204

        with self.assertRaises(TagKeyNotFound):
            tagstore.get_tag_key(project.id, None, tag_key)

    def test_protected(self):
        project = self.create_project()
        tag_key = 'environment'
        self.store_event(
            data={
                'fingerprint': ['put-me-in-group1'],
                tag_key: 'production',
                'timestamp': (timezone.now() - timedelta(minutes=5)).isoformat()[:19],
            },
            project_id=project.id,
        )

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-tagkey-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'key': tag_key,
            }
        )

        response = self.client.delete(url)

        assert response.status_code == 403

        assert tagstore.get_tag_key(
            project.id,
            None,
            tag_key,
            status=TagKeyStatus.VISIBLE
        ).status == TagKeyStatus.VISIBLE
