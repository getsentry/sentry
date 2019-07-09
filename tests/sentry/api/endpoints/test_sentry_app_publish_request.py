from __future__ import absolute_import

from django.core.urlresolvers import reverse

import mock
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature


class SentryAppPublishRequestTest(APITestCase):
    def setUp(self):
        # create user as superuser
        self.user = self.create_user(email='boop@example.com', is_superuser=True)
        self.org = self.create_organization(owner=self.user, name='My Org')
        self.project = self.create_project(organization=self.org)

        self.sentry_app = self.create_sentry_app(
            name='Testin',
            organization=self.org,
        )

        self.url = reverse(
            'sentry-api-0-sentry-app-publish-request',
            args=[self.sentry_app.slug],
        )

    @with_feature('organizations:sentry-apps')
    @mock.patch('sentry.utils.email.send_mail')
    def test_publish_request(self, send_mail):
        self.login_as(user=self.user)
        response = self.client.post(self.url, format='json')
        assert response.status_code == 201
        send_mail.assert_called_with('Sentry App Publication Request',
                                     'User boop@example.com of organization my-org wants to publish testin',
                                     'root@localhost', ['partners@sentry.io'], fail_silently=False)
