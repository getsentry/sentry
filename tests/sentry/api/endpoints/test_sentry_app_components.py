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


class OrganizationSentryAppComponentsTest(APITestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)

        self.sentry_app1 = self.create_sentry_app(
            schema=json.dumps({
                'elements': [self.create_issue_link_schema()],
            })
        )

        self.sentry_app2 = self.create_sentry_app(
            schema=json.dumps({
                'elements': [self.create_issue_link_schema()],
            })
        )

        self.sentry_app3 = self.create_sentry_app(
            schema=json.dumps({
                'elements': [self.create_issue_link_schema()],
            })
        )

        self.create_sentry_app_installation(
            slug=self.sentry_app1.slug,
            organization=self.org,
        )

        self.create_sentry_app_installation(
            slug=self.sentry_app2.slug,
            organization=self.org,
        )

        self.component1 = self.sentry_app1.components.first()
        self.component2 = self.sentry_app2.components.first()
        self.component3 = self.sentry_app3.components.first()

        self.url = reverse(
            'sentry-api-0-org-sentry-app-components',
            args=[self.org.slug],
        )

        self.login_as(user=self.user)

    @with_feature('organizations:sentry-apps')
    def test_retrieves_all_components_for_installed_apps(self):
        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert self.component3.uuid not in [d['uuid'] for d in response.data]
        assert response.data == [
            {
                'uuid': six.binary_type(self.component1.uuid),
                'type': 'issue-link',
                'schema': self.component1.schema,
                'sentryAppId': self.sentry_app1.id,
            },
            {
                'uuid': six.binary_type(self.component2.uuid),
                'type': 'issue-link',
                'schema': self.component2.schema,
                'sentryAppId': self.sentry_app2.id,
            },
        ]
