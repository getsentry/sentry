from __future__ import absolute_import, print_function

import six

from sentry.testutils import APITestCase


class SharedGroupDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event = self.create_event(group=group)

        url = '/api/0/shared/issues/{}/'.format(group.get_share_id())
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(group.id)
        assert response.data['latestEvent']['id'] == six.text_type(event.id)
        assert response.data['project']['slug'] == group.project.slug
        assert response.data['project']['organization']['slug'] == group.organization.slug

    def test_feature_disabled(self):
        self.login_as(user=self.user)

        group = self.create_group()
        org = group.organization
        org.flags.disable_shared_issues = True
        org.save()

        url = '/api/0/shared/issues/{}/'.format(group.get_share_id())
        response = self.client.get(url, format='json')

        assert response.status_code == 404
