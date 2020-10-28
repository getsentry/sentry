from __future__ import absolute_import

import six
import re

from sentry.utils.compat.mock import patch
from django.core.urlresolvers import reverse

from sentry.constants import SentryAppStatus
from sentry.utils import json
from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature, with_feature
from sentry.models import (
    SentryApp,
    SentryAppInstallationToken,
    SentryAppInstallation,
    ApiToken,
    OrganizationMember,
)
from sentry.models.sentryapp import MASKED_VALUE
from sentry.mediators import sentry_apps


class SentryAppsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.super_org = self.create_organization(owner=self.superuser)
        self.internal_org = self.create_organization(owner=self.user)

        self.published_app = self.create_sentry_app(
            name="Test", organization=self.org, published=True
        )

        self.unpublished_app = self.create_sentry_app(name="Testin", organization=self.org)

        self.unowned_unpublished_app = self.create_sentry_app(
            name="Nosee",
            organization=self.create_organization(),
            scopes=(),
            webhook_url="https://example.com",
        )

        self.create_project(organization=self.internal_org)
        self.internal_app = self.create_internal_integration(
            name="Internal", organization=self.internal_org
        )
        self.install = self.internal_app.installations.first()

        self.url = reverse("sentry-api-0-sentry-apps")


class GetSentryAppsTest(SentryAppsTest):
    def test_superuser_sees_all_apps(self):
        self.login_as(user=self.superuser, superuser=True)

        response = self.client.get(self.url, format="json")
        response_uuids = set(o["uuid"] for o in response.data)

        assert response.status_code == 200
        assert self.published_app.uuid in response_uuids
        assert self.unpublished_app.uuid in response_uuids
        assert self.unowned_unpublished_app.uuid in response_uuids

    def test_users_see_published_apps(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200
        assert {
            "name": self.published_app.name,
            "author": self.published_app.author,
            "slug": self.published_app.slug,
            "scopes": [],
            "events": [],
            "status": self.published_app.get_status_display(),
            "uuid": self.published_app.uuid,
            "webhookUrl": self.published_app.webhook_url,
            "redirectUrl": self.published_app.redirect_url,
            "isAlertable": self.published_app.is_alertable,
            "verifyInstall": self.published_app.verify_install,
            "clientId": self.published_app.application.client_id,
            "clientSecret": self.published_app.application.client_secret,
            "overview": self.published_app.overview,
            "allowedOrigins": [],
            "schema": {},
            "owner": {"id": self.org.id, "slug": self.org.slug},
            "featureData": [
                {
                    "featureGate": "integrations-api",
                    "description": "Test can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).",
                }
            ],
        } in json.loads(response.content)

    def test_users_filter_on_internal_apps(self):
        self.login_as(user=self.user)
        url = u"{}?status=internal".format(self.url)
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert {
            "name": self.internal_app.name,
            "author": self.internal_app.author,
            "slug": self.internal_app.slug,
            "scopes": [],
            "events": [],
            "status": self.internal_app.get_status_display(),
            "uuid": self.internal_app.uuid,
            "webhookUrl": self.internal_app.webhook_url,
            "redirectUrl": self.internal_app.redirect_url,
            "isAlertable": self.internal_app.is_alertable,
            "verifyInstall": self.internal_app.verify_install,
            "overview": self.internal_app.overview,
            "allowedOrigins": [],
            "schema": {},
            "clientId": self.internal_app.application.client_id,
            "clientSecret": self.internal_app.application.client_secret,
            "owner": {"id": self.internal_org.id, "slug": self.internal_org.slug},
            "featureData": [],
        } in json.loads(response.content)

        response_uuids = set(o["uuid"] for o in response.data)
        assert self.published_app.uuid not in response_uuids
        assert self.unpublished_app.uuid not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_superusers_filter_on_internal_apps(self):
        new_org = self.create_organization()
        self.create_project(organization=new_org)

        internal_app = self.create_internal_integration(name="Internal Nosee", organization=new_org)

        self.login_as(user=self.superuser, superuser=True)
        url = u"{}?status=internal".format(self.url)
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert {
            "name": self.internal_app.name,
            "author": self.internal_app.author,
            "slug": self.internal_app.slug,
            "scopes": [],
            "events": [],
            "status": self.internal_app.get_status_display(),
            "uuid": self.internal_app.uuid,
            "webhookUrl": self.internal_app.webhook_url,
            "redirectUrl": self.internal_app.redirect_url,
            "isAlertable": self.internal_app.is_alertable,
            "verifyInstall": self.internal_app.verify_install,
            "overview": self.internal_app.overview,
            "allowedOrigins": [],
            "schema": {},
            "clientId": self.internal_app.application.client_id,
            "clientSecret": self.internal_app.application.client_secret,
            "owner": {"id": self.internal_org.id, "slug": self.internal_org.slug},
            "featureData": [],
        } in json.loads(response.content)

        response_uuids = set(o["uuid"] for o in response.data)
        assert internal_app.uuid in response_uuids
        assert self.published_app.uuid not in response_uuids
        assert self.unpublished_app.uuid not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_superuser_filter_on_published(self):
        self.login_as(user=self.superuser, superuser=True)
        url = u"{}?status=published".format(self.url)
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert {
            "name": self.published_app.name,
            "author": self.published_app.author,
            "slug": self.published_app.slug,
            "scopes": [],
            "events": [],
            "status": self.published_app.get_status_display(),
            "uuid": self.published_app.uuid,
            "webhookUrl": self.published_app.webhook_url,
            "redirectUrl": self.published_app.redirect_url,
            "isAlertable": self.published_app.is_alertable,
            "verifyInstall": self.published_app.verify_install,
            "clientId": self.published_app.application.client_id,
            "clientSecret": self.published_app.application.client_secret,
            "overview": self.published_app.overview,
            "allowedOrigins": [],
            "schema": {},
            "owner": {"id": self.org.id, "slug": self.org.slug},
            "featureData": [
                {
                    "featureGate": "integrations-api",
                    "description": "Test can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).",
                }
            ],
        } in json.loads(response.content)

        response_uuids = set(o["uuid"] for o in response.data)
        assert self.unpublished_app.uuid not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_superuser_filter_on_unpublished(self):
        self.login_as(user=self.superuser, superuser=True)
        url = u"{}?status=unpublished".format(self.url)
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        response_uuids = set(o["uuid"] for o in response.data)
        assert self.unpublished_app.uuid in response_uuids
        assert self.unowned_unpublished_app.uuid in response_uuids
        assert self.published_app.uuid not in response_uuids

    def test_user_filter_on_unpublished(self):
        self.login_as(user=self.user)
        url = u"{}?status=unpublished".format(self.url)
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert {
            "name": self.unpublished_app.name,
            "author": self.unpublished_app.author,
            "slug": self.unpublished_app.slug,
            "scopes": [],
            "events": [],
            "status": self.unpublished_app.get_status_display(),
            "uuid": self.unpublished_app.uuid,
            "webhookUrl": self.unpublished_app.webhook_url,
            "redirectUrl": self.unpublished_app.redirect_url,
            "isAlertable": self.unpublished_app.is_alertable,
            "verifyInstall": self.unpublished_app.verify_install,
            "clientId": self.unpublished_app.application.client_id,
            "clientSecret": self.unpublished_app.application.client_secret,
            "overview": self.unpublished_app.overview,
            "allowedOrigins": [],
            "schema": {},
            "owner": {"id": self.org.id, "slug": self.org.slug},
            "featureData": [
                {
                    "featureGate": "integrations-api",
                    "description": "Testin can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).",
                }
            ],
        } in json.loads(response.content)

        response_uuids = set(o["uuid"] for o in response.data)
        assert self.published_app.uuid not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_user_filter_on_published(self):
        self.login_as(user=self.user)
        url = u"{}?status=published".format(self.url)
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        response_uuids = set(o["uuid"] for o in response.data)
        assert self.published_app.uuid in response_uuids
        assert self.unpublished_app not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_client_secret_is_masked(self):
        user = self.create_user(email="bloop@example.com")
        self.create_member(organization=self.org, user=user)
        # create an app with higher permissions that what the member role has
        sentry_app = self.create_sentry_app(
            name="Boo Far", organization=self.org, scopes=("project:write",)
        )
        self.login_as(user=user)
        url = u"{}?status=unpublished".format(self.url)
        response = self.client.get(url, format="json")
        assert {
            "name": sentry_app.name,
            "author": sentry_app.author,
            "slug": sentry_app.slug,
            "scopes": ["project:write"],
            "events": [],
            "status": sentry_app.get_status_display(),
            "uuid": sentry_app.uuid,
            "webhookUrl": sentry_app.webhook_url,
            "redirectUrl": sentry_app.redirect_url,
            "isAlertable": sentry_app.is_alertable,
            "verifyInstall": sentry_app.verify_install,
            "clientId": sentry_app.application.client_id,
            "clientSecret": MASKED_VALUE,
            "overview": sentry_app.overview,
            "allowedOrigins": [],
            "schema": {},
            "owner": {"id": self.org.id, "slug": self.org.slug},
            "featureData": [
                {
                    "featureGate": "integrations-api",
                    "description": "Boo Far can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).",
                }
            ],
        } in json.loads(response.content)

    def test_users_dont_see_unpublished_apps_their_org_owns(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200
        assert self.unpublished_app.uuid not in [a["uuid"] for a in response.data]

    def test_users_dont_see_unpublished_apps_outside_their_orgs(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200
        assert self.unowned_unpublished_app.uuid not in [a["uuid"] for a in response.data]

    def test_users_dont_see_internal_apps_outside_their_orgs(self):
        new_org = self.create_organization()
        self.create_project(organization=new_org)

        internal_app = self.create_internal_integration(name="Internal Nosee", organization=new_org)
        self.login_as(user=self.user)

        response = self.client.get(self.url, format="json")
        assert internal_app.uuid not in [a["uuid"] for a in response.data]


class PostSentryAppsTest(SentryAppsTest):
    def test_creates_sentry_app(self):
        self.login_as(user=self.user)

        response = self._post()
        expected = {
            "name": "MyApp",
            "scopes": ["project:read", "event:read"],
            "events": ["issue"],
            "webhookUrl": "https://example.com",
        }

        assert response.status_code == 201, response.content
        assert six.viewitems(expected) <= six.viewitems(json.loads(response.content))

    def test_non_unique_app_slug_fails(self):
        self.login_as(user=self.user)
        sentry_app = self.create_sentry_app(name="Foo Bar", organization=self.org)
        sentry_apps.Destroyer.run(sentry_app=sentry_app, user=self.user)
        response = self._post(**{"name": sentry_app.name})
        assert response.status_code == 400
        assert response.data == {"name": ["Name Foo Bar is already taken, please use another."]}

    def test_same_name_internal_integration(self):
        self.create_project(organization=self.org)
        self.login_as(user=self.user)
        sentry_app = self.create_internal_integration(name="Foo Bar", organization=self.org)
        response = self._post(**{"name": sentry_app.name})
        assert response.status_code == 201
        assert response.data["name"] == sentry_app.name
        assert response.data["slug"] != sentry_app.slug

    def test_long_name_internal_integration(self):
        self.create_project(organization=self.org)
        self.login_as(user=self.user)
        kwargs = {"name": "k" * 58}
        response = self._post(**kwargs)
        assert response.status_code == 400
        assert response.data == {"name": ["Cannot exceed 57 characters"]}

    def test_invalid_with_missing_webhool_url_scheme(self):
        self.login_as(user=self.user)
        kwargs = {"webhookUrl": "example.com"}
        response = self._post(**kwargs)

        assert response.status_code == 400
        assert response.data == {"webhookUrl": ["URL must start with http[s]://"]}

    def test_cannot_create_app_without_correct_permissions(self):
        self.login_as(user=self.user)
        kwargs = {"scopes": ("project:read",)}
        response = self._post(**kwargs)

        assert response.status_code == 400
        assert response.data == {"events": ["issue webhooks require the event:read permission."]}

    @patch("sentry.analytics.record")
    def test_wrong_schema_format(self, record):
        self.login_as(user=self.user)
        kwargs = {
            "schema": {
                "elements": [
                    {
                        "type": "alert-rule-action",
                        "required_fields": [
                            {
                                "type": "select",
                                "label": "Channel",
                                "name": "channel",
                                "options": [
                                    # option items should have 2 elements
                                    # i.e. ['channel_id', '#general']
                                    ["#general"]
                                ],
                            }
                        ],
                    }
                ]
            }
        }
        response = self._post(**kwargs)
        assert response.status_code == 400
        assert response.data == {
            "schema": ["['#general'] is too short for element of type 'alert-rule-action'"]
        }

        # XXX: Compare schema as an object instead of json to avoid key
        # ordering issues
        record.call_args.kwargs["schema"] = json.loads(record.call_args.kwargs["schema"])

        record.assert_called_with(
            "sentry_app.schema_validation_error",
            schema=kwargs["schema"],
            user_id=self.user.id,
            sentry_app_name="MyApp",
            organization_id=self.org.id,
            error_message="['#general'] is too short for element of type 'alert-rule-action'",
        )

    @with_feature("organizations:integrations-event-hooks")
    def test_can_create_with_error_created_hook_with_flag(self):
        self.login_as(user=self.user)

        kwargs = {"events": ("error",)}
        response = self._post(**kwargs)
        expected = {
            "name": "MyApp",
            "scopes": ["project:read", "event:read"],
            "events": ["error"],
            "webhookUrl": "https://example.com",
        }

        assert response.status_code == 201, response.content
        assert six.viewitems(expected) <= six.viewitems(json.loads(response.content))

    def test_cannot_create_with_error_created_hook_without_flag(self):
        self.login_as(user=self.user)

        with Feature({"organizations:integrations-event-hooks": False}):
            kwargs = {"events": ("error",)}
            response = self._post(**kwargs)

            assert response.status_code == 403, response.content
            assert response.data == {
                "non_field_errors": [
                    "Your organization does not have access to the 'error' resource subscription."
                ]
            }

    def test_allows_empty_schema(self):
        self.login_as(self.user)
        response = self._post(schema={})

        assert response.status_code == 201, response.content

    def test_missing_name(self):
        self.login_as(self.user)
        response = self._post(name=None)

        assert response.status_code == 400, response.content
        assert "name" in response.data

    def test_invalid_events(self):
        self.login_as(self.user)
        response = self._post(events=["project"])

        assert response.status_code == 400, response.content
        assert "events" in response.data

    def test_invalid_scope(self):
        self.login_as(self.user)
        response = self._post(scopes=("not:ascope",))

        assert response.status_code == 400, response.content
        assert "scopes" in response.data

    def test_missing_webhook_url(self):
        self.login_as(self.user)
        response = self._post(webhookUrl=None)

        assert response.status_code == 400, response.content
        assert "webhookUrl" in response.data

    def test_allows_empty_permissions(self):
        self.login_as(self.user)
        response = self._post(scopes=None)

        assert response.status_code == 201, response.content
        assert response.data["scopes"] == []

    def test_creates_internal_integration(self):
        self.create_project(organization=self.org)
        self.login_as(self.user)

        response = self._post(isInternal=True)

        assert re.match(r"myapp\-[0-9a-zA-Z]+", response.data["slug"])
        assert response.data["status"] == SentryAppStatus.as_str(SentryAppStatus.INTERNAL)
        assert not response.data["verifyInstall"]

        # verify tokens are created properly
        sentry_app = SentryApp.objects.get(slug=response.data["slug"])
        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)

        sentry_app_installation_token = SentryAppInstallationToken.objects.get(
            sentry_app_installation=sentry_app_installation
        )

        # Below line will fail once we stop assigning api_token on the sentry_app_installation
        assert sentry_app_installation_token.api_token == sentry_app_installation.api_token

    def test_no_author_public_integration(self):
        self.login_as(user=self.user)
        response = self._post(author=None)

        assert response.status_code == 400
        assert response.data == {"author": ["author required for public integrations"]}

    def test_no_author_internal_integration(self):
        self.create_project(organization=self.org)
        self.login_as(user=self.user)
        response = self._post(isInternal=True, author=None)

        assert response.status_code == 201

    def test_create_integration_with_allowed_origins(self):
        self.login_as(user=self.user)
        response = self._post(allowedOrigins=("google.com", "example.com"))

        assert response.status_code == 201
        sentry_app = SentryApp.objects.get(slug=response.data["slug"])
        assert sentry_app.application.get_allowed_origins() == ["google.com", "example.com"]

    def test_create_internal_integration_with_allowed_origins_and_test_route(self):
        self.create_project(organization=self.org)
        self.login_as(user=self.user)
        response = self._post(
            isInternal=True,
            allowedOrigins=("example.com",),
            scopes=("project:read", "event:read", "org:read"),
        )

        assert response.status_code == 201
        sentry_app = SentryApp.objects.get(slug=response.data["slug"])
        assert sentry_app.application.get_allowed_origins() == ["example.com"]

        token = ApiToken.objects.get(application=sentry_app.application)

        url = reverse("sentry-api-0-organization-projects", args=[self.org.slug])
        response = self.client.get(
            url, HTTP_ORIGIN="http://example.com", HTTP_AUTHORIZATION="Bearer %s" % (token.token)
        )
        assert response.status_code == 200

    def test_create_internal_integration_without_allowed_origins_and_test_route(self):
        self.create_project(organization=self.org)
        self.login_as(user=self.user)
        response = self._post(isInternal=True, scopes=("project:read", "event:read", "org:read"))

        assert response.status_code == 201
        sentry_app = SentryApp.objects.get(slug=response.data["slug"])
        assert sentry_app.application.get_allowed_origins() == []

        token = ApiToken.objects.get(application=sentry_app.application)

        url = reverse("sentry-api-0-organization-projects", args=[self.org.slug])
        response = self.client.get(
            url, HTTP_ORIGIN="http://example.com", HTTP_AUTHORIZATION="Bearer %s" % (token.token)
        )
        assert response.status_code == 400

    def test_create_integration_exceeding_scopes(self):
        member_om = OrganizationMember.objects.get(user=self.user, organization=self.org)
        member_om.role = "member"
        member_om.save()
        self.login_as(user=self.user)
        response = self._post(events=(), scopes=("member:read", "member:write", "member:admin"))

        assert response.status_code == 400
        assert response.data == {
            "scopes": [
                "Requested permission of member:write exceeds requester's permission. Please contact an administrator to make the requested change.",
                "Requested permission of member:admin exceeds requester's permission. Please contact an administrator to make the requested change.",
            ]
        }

    def test_create_internal_integration_with_non_globally_unique_name(self):
        # Internal integration names should only need to be unique within an organization
        self.login_as(user=self.user)
        self.create_project(organization=self.org)

        other_org = self.create_organization()
        other_org_integration = self.create_sentry_app(name="Foo Bar", organization=other_org)

        response = self._post(name=other_org_integration.name, isInternal=True)
        assert response.status_code == 201

        other_org = self.create_organization()
        self.create_project(organization=other_org)
        other_org_internal_integration = self.create_internal_integration(
            name="Foo Bar 2", organization=other_org
        )

        response = self._post(name=other_org_internal_integration.name, isInternal=True)
        assert response.status_code == 201

    def _post(self, **kwargs):
        body = {
            "name": "MyApp",
            "organization": self.org.slug,
            "author": "Sentry",
            "schema": None,
            "scopes": ("project:read", "event:read"),
            "events": ("issue",),
            "webhookUrl": "https://example.com",
            "redirectUrl": "",
            "isAlertable": False,
            "isInternal": False,
            "verifyInstall": True,
        }

        body.update(**kwargs)

        return self.client.post(self.url, body, headers={"Content-Type": "application/json"})
