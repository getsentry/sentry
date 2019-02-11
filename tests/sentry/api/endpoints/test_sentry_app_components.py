from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.utils import json


class SentryAppComponentsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email='a@example.com', is_superuser=True)
        self.user = self.create_user(email='boop@example.com')
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = self.create_sentry_app(
            name='Test',
            organization=self.org,
            published=True,
            schema=json.dumps({
                'elements': [self.create_issue_link_schema()],
            }),
        )

        self.component = self.sentry_app.components.first()

        self.url = reverse(
            'sentry-api-0-sentry-app-components',
            args=[self.sentry_app.slug],
        )

        self.login_as(user=self.user)

    @with_feature('organizations:sentry-apps')
    def test_retrieves_all_components(self):
        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert response.data[0] == {
            'uuid': six.binary_type(self.component.uuid),
            'type': 'issue-link',
            'schema': self.component.schema,
            'sentryAppId': self.sentry_app.id,
        }
