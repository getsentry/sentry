from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.utils import json
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature


class SentryAppsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email='a@example.com', is_superuser=True)
        self.user = self.create_user(email='boop@example.com')
        self.org = self.create_organization(owner=self.user)
        self.super_org = self.create_organization(owner=self.superuser)

        self.published_app = self.create_sentry_app(
            name='Test',
            organization=self.org,
            published=True,
        )

        self.unpublished_app = self.create_sentry_app(
            name='Testin',
            organization=self.org,
        )

        self.unowned_unpublished_app = self.create_sentry_app(
            name='Nosee',
            organization=self.create_organization(),
            scopes=(),
            webhook_url='https://example.com',
        )

        self.url = reverse('sentry-api-0-sentry-apps')


class GetSentryAppsTest(SentryAppsTest):
    @with_feature('organizations:internal-catchall')
    def test_superuser_sees_all_apps(self):
        self.login_as(user=self.superuser)

        response = self.client.get(self.url, format='json')
        response_uuids = set(o['uuid'] for o in response.data)

        assert response.status_code == 200
        assert self.published_app.uuid in response_uuids
        assert self.unpublished_app.uuid in response_uuids
        assert self.unowned_unpublished_app.uuid in response_uuids

    @with_feature('organizations:internal-catchall')
    def test_users_see_published_apps(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert {
            'name': self.published_app.name,
            'slug': self.published_app.slug,
            'scopes': [],
            'events': [],
            'status': self.published_app.get_status_display(),
            'uuid': self.published_app.uuid,
            'webhookUrl': self.published_app.webhook_url,
            'redirectUrl': self.published_app.redirect_url,
            'isAlertable': self.published_app.is_alertable,
            'clientId': self.published_app.application.client_id,
            'clientSecret': self.published_app.application.client_secret,
            'overview': self.published_app.overview,
        } in json.loads(response.content)

    @with_feature('organizations:internal-catchall')
    def test_users_see_unpublished_apps_their_org_owns(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert {
            'name': self.unpublished_app.name,
            'slug': self.unpublished_app.slug,
            'scopes': [],
            'events': [],
            'status': self.unpublished_app.get_status_display(),
            'uuid': self.unpublished_app.uuid,
            'webhookUrl': self.unpublished_app.webhook_url,
            'redirectUrl': self.unpublished_app.redirect_url,
            'isAlertable': self.unpublished_app.is_alertable,
            'clientId': self.unpublished_app.application.client_id,
            'clientSecret': self.unpublished_app.application.client_secret,
            'overview': self.unpublished_app.overview,
        } in json.loads(response.content)

    @with_feature('organizations:internal-catchall')
    def test_users_dont_see_unpublished_apps_outside_their_orgs(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert self.unowned_unpublished_app.uuid not in [
            a['uuid'] for a in response.data
        ]

    def test_no_access_without_internal_catchall(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')
        assert response.status_code == 404


class PostSentryAppsTest(SentryAppsTest):
    @with_feature('organizations:internal-catchall')
    def test_creates_sentry_app(self):
        self.login_as(user=self.user)

        response = self._post()
        expected = {
            'name': 'MyApp',
            'scopes': ['project:read', 'event:read'],
            'events': ['issue'],
            'webhookUrl': 'https://example.com',
        }

        assert response.status_code == 201, response.content
        assert six.viewitems(expected) <= six.viewitems(json.loads(response.content))

    @with_feature('organizations:internal-catchall')
    def test_cannot_create_app_without_correct_permissions(self):
        self.login_as(user=self.user)
        kwargs = {'scopes': ('project:read',)}
        response = self._post(**kwargs)

        assert response.status_code == 422
        assert response.data['errors'] == \
            {'events': ['issue webhooks require the event:read permission.']}

    @with_feature('organizations:internal-catchall')
    def test_missing_name(self):
        self.login_as(self.user)
        response = self._post(name=None)

        assert response.status_code == 422, response.content
        assert 'name' in response.data['errors']

    @with_feature('organizations:internal-catchall')
    def test_missing_scopes(self):
        self.login_as(self.user)
        response = self._post(scopes=None)

        assert response.status_code == 422, response.content
        assert 'scopes' in response.data['errors']

    @with_feature('organizations:internal-catchall')
    def test_invalid_events(self):
        self.login_as(self.user)
        response = self._post(events=['project'])

        assert response.status_code == 422, response.content
        assert 'events' in response.data['errors']

    @with_feature('organizations:internal-catchall')
    def test_invalid_scope(self):
        self.login_as(self.user)
        response = self._post(scopes=('not:ascope', ))

        assert response.status_code == 422, response.content
        assert 'scopes' in response.data['errors']

    @with_feature('organizations:internal-catchall')
    def test_missing_webhook_url(self):
        self.login_as(self.user)
        response = self._post(webhookUrl=None)

        assert response.status_code == 422, response.content
        assert 'webhookUrl' in response.data['errors']

    def _post(self, **kwargs):
        body = {
            'name': 'MyApp',
            'organization': self.org.slug,
            'scopes': ('project:read', 'event:read'),
            'events': ('issue',),
            'webhookUrl': 'https://example.com',
            'isAlertable': False,
        }

        body.update(**kwargs)

        return self.client.post(
            self.url,
            body,
            headers={'Content-Type': 'application/json'},
        )
