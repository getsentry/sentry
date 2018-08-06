from __future__ import absolute_import

import mock

from django.conf import settings
from django.core.urlresolvers import reverse

from sentry import tagstore
from sentry.tagstore import TagKeyStatus
from sentry.testutils import APITestCase


class ProjectTagKeyDetailsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        tagkey = tagstore.create_tag_key(
            project_id=project.id,
            environment_id=None,
            key='foo',
            values_seen=16
        )

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-tagkey-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'key': tagkey.key,
            }
        )

        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data['uniqueValues'] == tagkey.values_seen


class ProjectTagKeyDeleteTest(APITestCase):
    @mock.patch('sentry.tagstore.tasks.delete_tag_key')
    def test_simple(self, mock_delete_tag_key):
        project = self.create_project()
        tagkey = tagstore.create_tag_key(
            project_id=project.id,
            environment_id=None,
            key='foo')

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-tagkey-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'key': tagkey.key,
            }
        )

        response = self.client.delete(url)

        assert response.status_code == 204

        if settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.multi'):
            backend_count = len(settings.SENTRY_TAGSTORE_OPTIONS.get('backends', []))
            assert mock_delete_tag_key.delay.call_count == backend_count
        else:
            from sentry.tagstore.models import TagKey
            mock_delete_tag_key.delay.assert_called_once_with(object_id=tagkey.id, model=TagKey)

        assert tagstore.get_tag_key(
            project.id,
            None,  # environment_id
            tagkey.key,
            status=TagKeyStatus.PENDING_DELETION
        ).status == TagKeyStatus.PENDING_DELETION

    @mock.patch('sentry.tagstore.tasks.delete_tag_key')
    def test_protected(self, mock_delete_tag_key):
        project = self.create_project()
        tagkey = tagstore.create_tag_key(
            project_id=project.id,
            environment_id=None,
            key='environment')

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-tagkey-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'key': tagkey.key,
            }
        )

        response = self.client.delete(url)

        assert response.status_code == 403
        assert mock_delete_tag_key.delay.call_count == 0

        assert tagstore.get_tag_key(
            project.id,
            None,  # environment_id
            tagkey.key,
            status=TagKeyStatus.VISIBLE
        ).status == TagKeyStatus.VISIBLE
