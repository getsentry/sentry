from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse

from sentry.models import TagKey, TagKeyStatus
from sentry.testutils import APITestCase


class ProjectTagKeyDeleteTest(APITestCase):
    @mock.patch('sentry.api.endpoints.project_tagkey_details.delete_tag_key')
    def test_simple(self, mock_delete_tag_key):
        project = self.create_project()
        tagkey = TagKey.objects.create(project=project, key='foo')

        self.login_as(user=self.user)

        url = reverse('sentry-api-0-project-tagkey-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'key': tagkey.key,
        })

        response = self.client.delete(url)

        assert response.status_code == 204

        mock_delete_tag_key.delay.assert_called_once_with(
            object_id=tagkey.id
        )

        assert TagKey.objects.get(id=tagkey.id).status == TagKeyStatus.PENDING_DELETION
