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
    def test_superuser_sees_all_apps(self):
        self.login_as(user=self.superuser, superuser=True)

        response = self.client.get(self.url, format='json')
        response_uuids = set(o['uuid'] for o in response.data)

        assert response.status_code == 200
        assert self.published_app.uuid in response_uuids
        assert self.unpublished_app.uuid in response_uuids
        assert self.unowned_unpublished_app.uuid in response_uuids

    def test_users_see_published_apps(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert {
            'name': self.published_app.name,
            'author': self.published_app.author,
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
            'schema': {},
            'owner': {
                'id': self.org.id,
                'slug': self.org.slug,
            }
        } in json.loads(response.content)

    def test_superuser_filter_on_published(self):
        self.login_as(user=self.superuser, superuser=True)
        url = u'{}?status=published'.format(self.url)
        response = self.client.get(url, format='json')

        assert response.status_code == 200
        assert {
            'name': self.published_app.name,
            'author': self.published_app.author,
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
            'schema': {},
            'owner': {
                'id': self.org.id,
                'slug': self.org.slug,
            }
        } in json.loads(response.content)

        response_uuids = set(o['uuid'] for o in response.data)
        assert self.unpublished_app.uuid not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_superuser_filter_on_unpublished(self):
        self.login_as(user=self.superuser, superuser=True)
        url = u'{}?status=unpublished'.format(self.url)
        response = self.client.get(url, format='json')

        assert response.status_code == 200
        response_uuids = set(o['uuid'] for o in response.data)
        assert self.unpublished_app.uuid in response_uuids
        assert self.unowned_unpublished_app.uuid in response_uuids
        assert self.published_app.uuid not in response_uuids

    def test_user_filter_on_unpublished(self):
        self.login_as(user=self.user)
        url = u'{}?status=unpublished'.format(self.url)
        response = self.client.get(url, format='json')

        assert response.status_code == 200
        assert {
            'name': self.unpublished_app.name,
            'author': self.unpublished_app.author,
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
            'schema': {},
            'owner': {
                'id': self.org.id,
                'slug': self.org.slug,
            }
        } in json.loads(response.content)

        response_uuids = set(o['uuid'] for o in response.data)
        assert self.published_app.uuid not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

        def test_user_filter_on_published(self):
            self.login_as(user=self.user)
            url = u'{}?status=published'.format(self.url)
            response = self.client.get(url, format='json')

            assert response.status_code == 200
            response_uuids = set(o['uuid'] for o in response.data)
            assert self.published_app.uuid in response_uuids
            assert self.unpublished_app not in response_uuids
            assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_users_dont_see_unpublished_apps_their_org_owns(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert self.unpublished_app.uuid not in [
            a['uuid'] for a in response.data
        ]

    def test_users_dont_see_unpublished_apps_outside_their_orgs(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format='json')

        assert response.status_code == 200
        assert self.unowned_unpublished_app.uuid not in [
            a['uuid'] for a in response.data
        ]


class PostSentryAppsTest(SentryAppsTest):
    @with_feature('organizations:sentry-apps')
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

    @with_feature('organizations:sentry-apps')
    def test_non_unique_app_slug(self):
        from sentry.mediators import sentry_apps
        self.login_as(user=self.user)
        sentry_app = self.create_sentry_app(
            name='Foo Bar',
            organization=self.org,
        )
        sentry_apps.Destroyer.run(sentry_app=sentry_app, user=self.user)
        response = self._post(**{'name': sentry_app.name})
        assert response.status_code == 400
        assert response.data == \
            {"name": ["Name Foo Bar is already taken, please use another."]}

    @with_feature('organizations:sentry-apps')
    def test_invalid_with_missing_webhool_url_scheme(self):
        self.login_as(user=self.user)
        kwargs = {'webhookUrl': 'example.com'}
        response = self._post(**kwargs)

        assert response.status_code == 400
        assert response.data == \
            {'webhookUrl': ['URL must start with http[s]://']}

    @with_feature('organizations:sentry-apps')
    def test_cannot_create_app_without_correct_permissions(self):
        self.login_as(user=self.user)
        kwargs = {'scopes': ('project:read',)}
        response = self._post(**kwargs)

        assert response.status_code == 400
        assert response.data == \
            {'events': ['issue webhooks require the event:read permission.']}

    @with_feature('organizations:sentry-apps')
    def test_wrong_schema_format(self):
        self.login_as(user=self.user)
        kwargs = {'schema': {
            'elements': [
                {
                    'type': 'alert-rule-action',
                    'required_fields': [
                        {
                            'type': 'select',
                            'label': 'Channel',
                            'name': 'channel',
                            'options': [
                                # option items should have 2 elements
                                # i.e. ['channel_id', '#general']
                                ['#general'],
                            ]
                        },
                    ],
                }
            ],
        }}
        response = self._post(**kwargs)
        assert response.status_code == 400
        assert response.data == \
            {'schema': ["['#general'] is too short"]}

    @with_feature('organizations:sentry-apps')
    def test_allows_empty_schema(self):
        self.login_as(self.user)
        response = self._post(schema={})

        assert response.status_code == 201, response.content

    @with_feature('organizations:sentry-apps')
    def test_missing_name(self):
        self.login_as(self.user)
        response = self._post(name=None)

        assert response.status_code == 400, response.content
        assert 'name' in response.data

    @with_feature('organizations:sentry-apps')
    def test_invalid_events(self):
        self.login_as(self.user)
        response = self._post(events=['project'])

        assert response.status_code == 400, response.content
        assert 'events' in response.data

    @with_feature('organizations:sentry-apps')
    def test_invalid_scope(self):
        self.login_as(self.user)
        response = self._post(scopes=('not:ascope', ))

        assert response.status_code == 400, response.content
        assert 'scopes' in response.data

    @with_feature('organizations:sentry-apps')
    def test_missing_webhook_url(self):
        self.login_as(self.user)
        response = self._post(webhookUrl=None)

        assert response.status_code == 400, response.content
        assert 'webhookUrl' in response.data

    @with_feature('organizations:sentry-apps')
    def test_allows_empty_permissions(self):
        self.login_as(self.user)
        response = self._post(scopes=None)

        assert response.status_code == 201, response.content
        assert response.data['scopes'] == []

    def _post(self, **kwargs):
        body = {
            'name': 'MyApp',
            'organization': self.org.slug,
            'author': 'Sentry',
            'schema': None,
            'scopes': ('project:read', 'event:read'),
            'events': ('issue',),
            'webhookUrl': 'https://example.com',
            'redirectUrl': '',
            'isAlertable': False,
        }

        body.update(**kwargs)

        return self.client.post(
            self.url,
            body,
            headers={'Content-Type': 'application/json'},
        )
