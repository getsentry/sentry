from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any
from unittest.mock import patch

import orjson
import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.response import Response

from sentry import deletions
from sentry.constants import SentryAppStatus
from sentry.models.apitoken import ApiToken
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.sentry_apps.models.sentry_app import MASKED_VALUE, SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature, with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

POPULARITY = 27
EXPECTED = {
    "events": ["issue"],
    "name": "MyApp",
    "scopes": [
        "event:read",
        "project:read",
        "org:read",
        "org:write",
        "org:admin",
        "org:integrations",
    ],
    "webhookUrl": "https://example.com",
}


class MockOrganizationRoles:
    TEST_ORG_ROLES = [
        {
            "id": "alice",
            "name": "Alice",
            "desc": "In Wonderland",
            "scopes": ["rabbit:follow"],
        },
        {
            "id": "owner",
            "name": "Owner",
            "desc": "Minimal version of Owner",
            "scopes": ["org:admin"],
        },
    ]

    TEST_TEAM_ROLES = [
        {"id": "alice", "name": "Alice", "desc": "In Wonderland"},
    ]

    def __init__(self):
        from sentry.roles.manager import RoleManager

        self.default_manager = RoleManager(self.TEST_ORG_ROLES, self.TEST_TEAM_ROLES)
        self.organization_roles = self.default_manager.organization_roles

    def get(self, x):
        return self.organization_roles.get(x)


class SentryAppsTest(APITestCase):
    endpoint = "sentry-api-0-sentry-apps"

    def setUp(self):
        super().setUp()
        self.default_popularity = SentryApp._meta.get_field("popularity").default

    def setup_apps(self):
        self.published_app = self.create_sentry_app(organization=self.organization, published=True)
        self.unpublished_app = self.create_sentry_app(organization=self.organization)
        self.unowned_unpublished_app = self.create_sentry_app(
            organization=self.create_organization(),
            scopes=(),
            webhook_url="https://example.com",
        )

    def setup_internal_app(self) -> None:
        self.internal_organization = self.create_organization(owner=self.user)
        self.create_project(organization=self.internal_organization)
        self.internal_app = self.create_internal_integration(
            name="Internal", organization=self.internal_organization
        )
        self.create_internal_integration_token(
            user=self.user, internal_integration=self.internal_app
        )

    def assert_response_has_serialized_sentry_app(
        self,
        response: Response,
        sentry_app: SentryApp,
        organization: Organization,
        has_features: bool = False,
        mask_secret: bool = False,
        scopes: list[str] | None = None,
    ) -> None:
        assert sentry_app.application is not None
        data = {
            "allowedOrigins": [],
            "author": sentry_app.author,
            "avatars": [],
            "clientId": sentry_app.application.client_id,
            "clientSecret": sentry_app.application.client_secret,
            "events": [],
            "featureData": [],
            "isAlertable": sentry_app.is_alertable,
            "name": sentry_app.name,
            "overview": sentry_app.overview,
            "owner": {"id": organization.id, "slug": organization.slug},
            "popularity": self.default_popularity,
            "redirectUrl": sentry_app.redirect_url,
            "schema": {},
            "scopes": scopes if scopes else [],
            "slug": sentry_app.slug,
            "status": sentry_app.get_status_display(),
            "uuid": sentry_app.uuid,
            "verifyInstall": sentry_app.verify_install,
            "webhookUrl": sentry_app.webhook_url,
            "metadata": {},
        }

        if mask_secret:
            data["clientSecret"] = MASKED_VALUE

        if has_features:
            data["featureData"] = [
                {
                    "featureId": 0,
                    "featureGate": "integrations-api",
                    "description": (
                        f"{sentry_app.name} can **utilize the Sentry API** to pull data or"
                        + " update resources in Sentry (with permissions granted, of course)."
                    ),
                }
            ]

        assert data in orjson.loads(response.content)

    def get_data(self, **kwargs: Any) -> Mapping[str, Any]:
        return {
            "author": "Sentry",
            "events": ("issue",),
            "isAlertable": False,
            "isInternal": False,
            "name": "MyApp",
            "organization": self.organization.slug,
            "redirectUrl": "",
            "schema": None,
            "scopes": (
                "project:read",
                "event:read",
                "org:read",
                "org:write",
                "org:admin",
                "org:integrations",
            ),
            "verifyInstall": True,
            "webhookUrl": "https://example.com",
            **kwargs,
        }

    def make_token_request(
        self,
        token: ApiToken,
        endpoint: str,
        method: str = "get",
        data: Mapping[str, Any] | None = None,
    ) -> Response:
        return getattr(self.client, method)(
            reverse(endpoint),
            format="json",
            **data,
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            headers={"Content-Type": "application/json"},
        )


@control_silo_test
class SuperuserStaffGetSentryAppsTest(SentryAppsTest):
    def setUp(self):
        super().setUp()
        self.setup_apps()

        self.superuser = self.create_user(is_superuser=True)
        self.login_as(self.superuser, superuser=True)

    def test_staff_sees_all_apps(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(staff_user, staff=True)

        response = self.get_success_response(status_code=200)
        response_uuids = {o["uuid"] for o in response.data}

        assert self.published_app.uuid in response_uuids
        assert self.unpublished_app.uuid in response_uuids
        assert self.unowned_unpublished_app.uuid in response_uuids

        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_success_response(status_code=200)

    def test_superuser_sees_all_apps(self):
        response = self.get_success_response(status_code=200)
        response_uuids = {o["uuid"] for o in response.data}

        assert self.published_app.uuid in response_uuids
        assert self.unpublished_app.uuid in response_uuids
        assert self.unowned_unpublished_app.uuid in response_uuids

        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_success_response(status_code=200)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_write_sees_all_apps(self):
        self.get_success_response(status_code=200)

        self.add_user_permission(self.superuser, "superuser.write")
        self.get_success_response(status_code=200)

    def test_superusers_filter_on_internal_apps(self):
        self.setup_internal_app()
        new_org = self.create_organization()
        self.create_project(organization=new_org)

        internal_app = self.create_internal_integration(name="Internal Nosee", organization=new_org)

        response = self.get_success_response(qs_params={"status": "internal"}, status_code=200)
        self.assert_response_has_serialized_sentry_app(
            response=response, sentry_app=self.internal_app, organization=self.internal_organization
        )
        response_uuids = {o["uuid"] for o in response.data}
        assert internal_app.uuid in response_uuids
        assert self.published_app.uuid not in response_uuids
        assert self.unpublished_app.uuid not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_superuser_filter_on_published(self):
        response = self.get_success_response(qs_params={"status": "published"}, status_code=200)
        self.assert_response_has_serialized_sentry_app(
            response=response,
            sentry_app=self.published_app,
            organization=self.organization,
            has_features=True,
        )

        response_uuids = {o["uuid"] for o in response.data}
        assert self.unpublished_app.uuid not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_superuser_filter_on_unpublished(self):
        response = self.get_success_response(qs_params={"status": "unpublished"}, status_code=200)

        response_uuids = {o["uuid"] for o in response.data}
        assert self.unpublished_app.uuid in response_uuids
        assert self.unowned_unpublished_app.uuid in response_uuids
        assert self.published_app.uuid not in response_uuids


@control_silo_test
class GetSentryAppsTest(SentryAppsTest):
    def setUp(self):
        super().setUp()
        self.setup_apps()
        self.login_as(self.user)

    def test_users_see_published_apps(self):
        response = self.get_success_response(status_code=200)
        self.assert_response_has_serialized_sentry_app(
            response=response,
            sentry_app=self.published_app,
            organization=self.organization,
            has_features=True,
        )

    def test_users_filter_on_internal_apps(self):
        self.setup_internal_app()
        response = self.get_success_response(qs_params={"status": "internal"}, status_code=200)
        self.assert_response_has_serialized_sentry_app(
            response=response,
            sentry_app=self.internal_app,
            organization=self.internal_organization,
        )
        response_uuids = {o["uuid"] for o in response.data}
        assert self.published_app.uuid not in response_uuids
        assert self.unpublished_app.uuid not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_user_filter_on_unpublished(self):
        response = self.get_success_response(qs_params={"status": "unpublished"}, status_code=200)
        self.assert_response_has_serialized_sentry_app(
            response=response,
            sentry_app=self.unpublished_app,
            organization=self.organization,
            has_features=True,
        )
        response_uuids = {o["uuid"] for o in response.data}
        assert self.published_app.uuid not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_user_filter_on_published(self):
        response = self.get_success_response(qs_params={"status": "published"}, status_code=200)
        response_uuids = {o["uuid"] for o in response.data}
        assert self.published_app.uuid in response_uuids
        assert self.unpublished_app not in response_uuids
        assert self.unowned_unpublished_app.uuid not in response_uuids

    def test_client_secret_is_not_masked(self):
        manager_user = self.create_user(email="bleep@example.com")
        self.create_member(organization=self.organization, user=manager_user, role="manager")

        # Create an app with the same permission that what the manager role has.
        sentry_app = self.create_sentry_app(
            name="Boo Far", organization=self.organization, scopes=("org:write",)
        )

        self.login_as(manager_user)
        response = self.get_success_response(qs_params={"status": "unpublished"}, status_code=200)
        self.assert_response_has_serialized_sentry_app(
            response=response,
            sentry_app=sentry_app,
            organization=self.organization,
            has_features=True,
            mask_secret=False,
            scopes=["org:write"],
        )

    def test_client_secret_is_masked(self):
        manager_user = self.create_user(email="bloop@example.com")
        self.create_member(organization=self.organization, user=manager_user, role="manager")

        # Create an app with higher permissions that what the manager role has.
        sentry_app = self.create_sentry_app(
            name="Boo Far", organization=self.organization, scopes=("org:admin",)
        )

        self.login_as(manager_user)
        response = self.get_success_response(qs_params={"status": "unpublished"}, status_code=200)
        self.assert_response_has_serialized_sentry_app(
            response=response,
            sentry_app=sentry_app,
            organization=self.organization,
            has_features=True,
            mask_secret=True,
            scopes=["org:admin"],
        )

    def test_users_dont_see_unpublished_apps_their_org_owns(self):
        response = self.get_success_response(status_code=200)
        assert self.unpublished_app.uuid not in [a["uuid"] for a in response.data]

    def test_users_dont_see_unpublished_apps_outside_their_orgs(self):
        response = self.get_success_response(status_code=200)
        assert self.unowned_unpublished_app.uuid not in [a["uuid"] for a in response.data]

    def test_users_dont_see_internal_apps_outside_their_orgs(self):
        new_org = self.create_organization()
        self.create_project(organization=new_org)

        internal_app = self.create_internal_integration(name="Internal Nosee", organization=new_org)

        response = self.get_success_response(status_code=200)
        assert internal_app.uuid not in [a["uuid"] for a in response.data]

    def test_billing_users_dont_see_apps(self):
        mock_org_roles = MockOrganizationRoles()
        with (patch("sentry.roles.organization_roles.get", mock_org_roles.get),):
            alice = self.create_member(
                user=self.create_user(), organization=self.organization, role="alice"
            )
            self.login_as(alice)

            response = self.get_success_response(
                qs_params={"status": "unpublished"}, status_code=200
            )
            assert response.status_code == 200
            content = orjson.loads(response.content)
            assert content == []


@control_silo_test
class SuperuserStaffPostSentryAppsTest(SentryAppsTest):
    method = "post"

    def setUp(self):
        super().setUp()
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)
        self.login_as(self.superuser, superuser=True)

    def test_staff_cannot_create_app(self):
        """We do not allow staff to create Sentry Apps b/c this cannot be done in _admin."""
        self.login_as(self.staff_user, staff=True)
        response = self.get_error_response(**self.get_data(), status_code=400)
        assert (
            response.data["detail"]
            == "User must be a part of the Org they're trying to create the app in"
        )

    def test_superuser_cannot_create_app_in_nonexistent_organization(self):
        sentry_app = self.create_internal_integration(name="Foo Bar")

        data = self.get_data(name=sentry_app.name, organization="some-non-existent-org")
        response = self.get_error_response(**data, status_code=400)
        assert response.data == {"detail": "Organization 'some-non-existent-org' does not exist."}

    def test_superuser_can_create_with_popularity(self):
        response = self.get_success_response(
            **self.get_data(popularity=POPULARITY), status_code=201
        )
        assert {"popularity": POPULARITY}.items() <= orjson.loads(response.content).items()

        with self.settings(SENTRY_SELF_HOSTED=False):
            self.get_success_response(
                **self.get_data(popularity=25, name="myApp 2"), status_code=201
            )

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_cannot_create(self):
        self.get_error_response(**self.get_data(name="POPULARITY"))

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_can_create(self):
        self.add_user_permission(self.superuser, "superuser.write")
        self.get_success_response(**self.get_data(popularity=POPULARITY), status_code=201)


@control_silo_test
class PostWithTokenSentryAppsTest(SentryAppsTest):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.setup_internal_app()

    def assert_no_permission(
        self, organization: Organization, sentry_app: SentryApp, slug: str | None
    ):
        self.create_project(organization=organization)
        token = ApiToken.objects.get(application=sentry_app.application)

        data = self.get_data(name=sentry_app.name, organization=slug)
        response = self.make_token_request(token, self.endpoint, method="post", data=data)
        assert response.status_code == 403
        assert response.data["detail"].startswith("You do not have permission")

    def test_internal_sentry_app_cannot_create_app(self):
        self.assert_no_permission(
            organization=self.internal_organization,
            sentry_app=self.internal_app,
            slug=self.internal_organization.slug,
        )

    def test_internal_sentry_app_cannot_create_app_without_organization(self):
        self.assert_no_permission(
            organization=self.internal_organization,
            sentry_app=self.internal_app,
            slug=None,
        )

    def test_internal_sentry_app_cannot_create_app_in_alien_organization(self):
        other_organization = self.create_organization()
        self.assert_no_permission(
            organization=other_organization,
            sentry_app=self.internal_app,
            slug=other_organization.slug,
        )

    def test_internal_sentry_app_cannot_create_app_in_nonexistent_organization(self):
        self.assert_no_permission(
            organization=self.organization,
            sentry_app=self.internal_app,
            slug="some-non-existent-org",
        )


@control_silo_test
class PostSentryAppsTest(SentryAppsTest):
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def assert_sentry_app_status_code(self, sentry_app: SentryApp, status_code: int) -> None:
        token = ApiToken.objects.create(
            application=sentry_app.application,
            user_id=self.user.id,
            refresh_token=None,
            scope_list=["project:read", "event:read", "org:read"],
        )

        with assume_test_silo_mode(SiloMode.REGION):
            url = reverse("sentry-api-0-organization-projects", args=[self.organization.slug])
            response = self.client.get(
                url, HTTP_ORIGIN="http://example.com", HTTP_AUTHORIZATION=f"Bearer {token.token}"
            )
            assert response.status_code == status_code

    def test_creates_sentry_app(self):
        response = self.get_success_response(**self.get_data(), status_code=201)
        content = orjson.loads(response.content)
        for key, value in EXPECTED.items():
            assert key in content
            if isinstance(value, list):
                assert sorted(content[key]) == sorted(value)
            else:
                assert content[key] == value

    def test_non_unique_app_slug_fails(self):
        sentry_app = self.create_sentry_app(name="Foo Bar", organization=self.organization)
        deletions.exec_sync(sentry_app)

        data = self.get_data(name=sentry_app.name)
        response = self.get_error_response(**data, status_code=400)
        assert response.data == {"name": ["Name Foo Bar is already taken, please use another."]}

    def test_same_name_internal_integration(self):
        self.create_project(organization=self.organization)
        sentry_app = self.create_internal_integration(
            name="Foo Bar", organization=self.organization
        )

        data = self.get_data(name=sentry_app.name)
        response = self.get_success_response(**data, status_code=201)
        assert response.data["name"] == sentry_app.name
        assert response.data["slug"] != sentry_app.slug

    def test_cannot_create_app_without_organization(self):
        self.create_project(organization=self.organization)
        sentry_app = self.create_internal_integration(name="Foo Bar")

        data = self.get_data(name=sentry_app.name, organization=None)
        response = self.get_error_response(**data, status_code=400)
        assert response.data == {
            "detail": "Please provide a valid value for the 'organization' field.",
        }

    def test_cannot_create_app_in_alien_organization(self):
        other_organization = self.create_organization()
        self.create_project(organization=other_organization)
        sentry_app = self.create_internal_integration(name="Foo Bar")

        data = self.get_data(name=sentry_app.name, organization=other_organization.slug)
        response = self.get_error_response(**data, status_code=400)
        assert response.data["detail"].startswith("User does not belong to")

    def test_user_cannot_create_app_in_nonexistent_organization(self):
        self.create_project(organization=self.organization)
        sentry_app = self.create_internal_integration(name="Foo Bar")

        data = self.get_data(name=sentry_app.name, organization="some-non-existent-org")
        response = self.get_error_response(**data, status_code=400)
        assert response.data["detail"].startswith("User does not belong to")

    def test_nonsuperuser_cannot_create_with_popularity(self):
        response = self.get_success_response(
            **self.get_data(popularity=POPULARITY), status_code=201
        )
        assert {"popularity": self.default_popularity}.items() <= orjson.loads(
            response.content
        ).items()

    def test_long_name_internal_integration(self):
        self.create_project(organization=self.organization)

        response = self.get_error_response(**self.get_data(name="k" * 58), status_code=400)
        assert response.data == {"name": ["Cannot exceed 57 characters"]}

    def test_invalid_with_missing_webhook_url_scheme(self):
        data = self.get_data(webhookUrl="example.com")
        response = self.get_error_response(**data, status_code=400)
        assert response.data == {"webhookUrl": ["URL must start with http[s]://"]}

    def test_cannot_create_app_without_correct_permissions(self):
        data = self.get_data(scopes=("project:read",))
        response = self.get_error_response(**data, status_code=400)
        assert response.data == {"events": ["issue webhooks require the event:read permission."]}

    def test_create_alert_rule_action(self):
        expected = {**EXPECTED, "schema": {"elements": [self.create_alert_rule_action_schema()]}}

        data = self.get_data(schema={"elements": [self.create_alert_rule_action_schema()]})
        response = self.get_success_response(**data, status_code=201)
        content = orjson.loads(response.content)
        for key, value in expected.items():
            assert key in content
            if isinstance(value, list):
                assert sorted(content[key]) == sorted(value)
            else:
                assert content[key] == value

    @patch("sentry.analytics.record")
    def test_wrong_schema_format(self, record):
        kwargs = {
            "schema": {
                "elements": [
                    {
                        "type": "alert-rule-action",
                        "title": "Create task",
                        "settings": {
                            "type": "alert-rule-settings",
                            "uri": "/sentry/alert-rule",
                            "required_fields": [
                                {
                                    "type": "select",
                                    "label": "Channel",
                                    "name": "channel",
                                    "options": [
                                        # Option items should have 2 elements
                                        # i.e. ['channel_id', '#general']
                                        ["#general"]
                                    ],
                                }
                            ],
                        },
                    }
                ]
            }
        }

        response = self.get_error_response(**self.get_data(**kwargs), status_code=400)
        assert response.data == {
            "schema": ["['#general'] is too short for element of type 'alert-rule-action'"]
        }

        # XXX: Compare schema as an object instead of json to avoid key ordering issues
        record.call_args.kwargs["schema"] = orjson.loads(record.call_args.kwargs["schema"])

        record.assert_called_with(
            "sentry_app.schema_validation_error",
            schema=kwargs["schema"],
            user_id=self.user.id,
            sentry_app_name="MyApp",
            organization_id=self.organization.id,
            error_message="['#general'] is too short for element of type 'alert-rule-action'",
        )

    @with_feature("organizations:integrations-event-hooks")
    def test_can_create_with_error_created_hook_with_flag(self):
        expected = {**EXPECTED, "events": ["error"]}
        response = self.get_success_response(**self.get_data(events=("error",)), status_code=201)
        content = orjson.loads(response.content)
        for key, value in expected.items():
            assert key in content
            if isinstance(value, list):
                assert sorted(content[key]) == sorted(value)
            else:
                assert content[key] == value

    def test_cannot_create_with_error_created_hook_without_flag(self):
        with Feature({"organizations:integrations-event-hooks": False}):
            response = self.get_error_response(**self.get_data(events=("error",)), status_code=403)
            assert response.data == {
                "non_field_errors": [
                    "Your organization does not have access to the 'error' resource subscription."
                ]
            }

    def test_allows_empty_schema(self):
        self.get_success_response(**self.get_data(shema={}), status_code=201)

    def test_generated_slug_not_entirely_numeric(self):
        response = self.get_success_response(**self.get_data(name="1234"), status_code=201)
        slug = response.data["slug"]
        assert slug.startswith("1234-")
        assert not slug.isdecimal()

    def test_missing_name(self):
        response = self.get_error_response(**self.get_data(name=None), status_code=400)
        assert "name" in response.data

    def test_invalid_events(self):
        response = self.get_error_response(**self.get_data(events=["project"]), status_code=400)
        assert "events" in response.data

    def test_invalid_scope(self):
        response = self.get_error_response(**self.get_data(scopes="not:ascope"), status_code=400)
        assert "scopes" in response.data

    def test_missing_webhook_url(self):
        response = self.get_error_response(**self.get_data(webhookUrl=None), status_code=400)
        assert "webhookUrl" in response.data

    def test_allows_empty_permissions(self):
        response = self.get_success_response(**self.get_data(scopes=None), status_code=201)
        assert response.data["scopes"] == []

    def test_creates_internal_integration(self):
        self.create_project(organization=self.organization)

        response = self.get_success_response(**self.get_data(isInternal=True), status_code=201)
        assert re.match(r"myapp\-[0-9a-zA-Z]+", response.data["slug"])
        assert response.data["status"] == SentryAppStatus.as_str(SentryAppStatus.INTERNAL)
        assert not response.data["verifyInstall"]

        # Verify no tokens are created.
        sentry_app = SentryApp.objects.get(slug=response.data["slug"])
        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)

        with pytest.raises(SentryAppInstallationToken.DoesNotExist):
            SentryAppInstallationToken.objects.get(sentry_app_installation=sentry_app_installation)

    def test_no_author_public_integration(self):
        response = self.get_error_response(**self.get_data(author=None), status_code=400)
        assert response.data == {"author": ["author required for public integrations"]}

    def test_no_author_internal_integration(self):
        self.create_project(organization=self.organization)

        self.get_success_response(**self.get_data(isInternal=True, author=None), status_code=201)

    def test_create_integration_with_allowed_origins(self):
        response = self.get_success_response(
            **self.get_data(allowedOrigins=("google.com", "example.com")), status_code=201
        )
        sentry_app = SentryApp.objects.get(slug=response.data["slug"])
        assert sentry_app.application is not None
        assert sentry_app.application.get_allowed_origins() == ["google.com", "example.com"]

    def test_create_internal_integration_with_allowed_origins_and_test_route(self):
        self.create_project(organization=self.organization)

        data = self.get_data(
            isInternal=True,
            allowedOrigins=("example.com",),
            scopes=("project:read", "event:read", "org:read"),
        )
        response = self.get_success_response(**data, status_code=201)
        sentry_app = SentryApp.objects.get(slug=response.data["slug"])
        assert sentry_app.application is not None
        assert sentry_app.application.get_allowed_origins() == ["example.com"]

        self.assert_sentry_app_status_code(sentry_app, status_code=200)

    def test_create_internal_integration_without_allowed_origins_and_test_route(self):
        self.create_project(organization=self.organization)

        data = self.get_data(isInternal=True, scopes=("project:read", "event:read", "org:read"))
        response = self.get_success_response(**data, status_code=201)
        sentry_app = SentryApp.objects.get(slug=response.data["slug"])
        assert sentry_app.application is not None
        assert sentry_app.application.get_allowed_origins() == []

        self.assert_sentry_app_status_code(sentry_app, status_code=400)

    def test_members_cant_create(self):
        # create extra owner because we are demoting one
        self.create_member(organization=self.organization, user=self.create_user(), role="owner")
        with assume_test_silo_mode(SiloMode.REGION):
            member_om = OrganizationMember.objects.get(
                user_id=self.user.id, organization=self.organization
            )
            member_om.role = "member"
            member_om.save()

        self.get_error_response(**self.get_data(), status_code=403)

    def test_create_integration_exceeding_scopes(self):
        # create extra owner because we are demoting one
        self.create_member(organization=self.organization, user=self.create_user(), role="owner")
        with assume_test_silo_mode(SiloMode.REGION):
            member_om = OrganizationMember.objects.get(
                user_id=self.user.id, organization=self.organization
            )
            member_om.role = "manager"
            member_om.save()

        data = self.get_data(events=(), scopes=("org:read", "org:write", "org:admin"))
        response = self.get_error_response(**data, status_code=400)
        assert response.data == {
            "scopes": [
                "Requested permission of org:admin exceeds requester's permission."
                " Please contact an administrator to make the requested change.",
            ]
        }

    def test_create_internal_integration_with_non_globally_unique_name(self):
        # Internal integration names should only need to be unique within an organization.
        self.create_project(organization=self.organization)

        other_organization = self.create_organization()
        other_organization_integration = self.create_sentry_app(
            name="Foo Bar", organization=other_organization
        )

        self.get_success_response(
            **self.get_data(name=other_organization_integration.name, isInternal=True),
            status_code=201,
        )

        other_organization = self.create_organization()
        self.create_project(organization=other_organization)
        other_organization_internal_integration = self.create_internal_integration(
            name="Foo Bar 2", organization=other_organization
        )

        self.get_success_response(
            **self.get_data(name=other_organization_internal_integration.name, isInternal=True),
            status_code=201,
        )
