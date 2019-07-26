from __future__ import absolute_import

from django.core.urlresolvers import reverse

import mock
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.constants import SentryAppStatus


class SentryAppPublishRequestTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='boop@example.com')
        self.org = self.create_organization(owner=self.user, name='My Org')
        self.project = self.create_project(organization=self.org)

        self.internal_sentry_app = self.create_sentry_app(
            name='My Internal App',
            organization=self.org,
            internal=True
        )

        self.url = reverse(
            'sentry-api-0-sentry-internal-app-tokens',
            args=[self.internal_sentry_app.slug],
        )

    @with_feature('organizations:sentry-apps')
    def test_create_token(self):
        self.login_as(user=self.user)
        response = self.client.post(self.url, format='json')
        assert response.status_code == 201
        # send_mail.assert_called_with('Sentry App Publication Request',
        #                              'User boop@example.com of organization my-org wants to publish testin',
        #                              'root@localhost', ['partners@sentry.io'], fail_silently=False)
