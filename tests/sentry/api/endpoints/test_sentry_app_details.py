from unittest.mock import patch

from sentry import audit_log, deletions
from sentry.api.endpoints.integrations.sentry_apps.details import (
    PARTNERSHIP_RESTRICTED_ERROR_MESSAGE,
)
from sentry.constants import SentryAppStatus
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.organizationmember import OrganizationMember
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json


class SentryAppDetailsTest(APITestCase):
    endpoint = "sentry-api-0-sentry-app-details"

    def setUp(self):
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.update(is_superuser=False, is_staff=False)
        self.login_as(self.user)

        self.popularity = 27
        self.published_app = self.create_sentry_app(
            name="Test",
            organization=self.organization,
            published=True,
            popularity=self.popularity,
        )
        self.unpublished_app = self.create_sentry_app(
            name="Testin",
            organization=self.organization,
            popularity=self.popularity,
        )
        self.unowned_unpublished_app = self.create_sentry_app(
            name="Nosee",
            organization=self.create_organization(),
            scopes=(),
            webhook_url="https://example.com",
            popularity=self.popularity,
        )
        self.internal_integration = self.create_internal_integration(organization=self.organization)


@control_silo_test
class GetSentryAppDetailsTest(SentryAppDetailsTest):
    method = "GET"

    def test_superuser_sees_all_apps(self):
        self.login_as(user=self.superuser, superuser=True)

        response = self.get_success_response(self.published_app.slug, status_code=200)
        assert response.data["uuid"] == self.published_app.uuid

        response = self.get_success_response(self.unpublished_app.slug, status_code=200)
        assert response.data["uuid"] == self.unpublished_app.uuid

    def test_staff_sees_all_apps(self):
        self.login_as(user=self.staff_user, staff=True)

        response = self.get_success_response(self.published_app.slug, status_code=200)
        assert response.data["uuid"] == self.published_app.uuid

        response = self.get_success_response(self.unpublished_app.slug, status_code=200)
        assert response.data["uuid"] == self.unpublished_app.uuid

    def test_users_see_published_app(self):
        response = self.get_success_response(self.published_app.slug, status_code=200)
        assert response.data["uuid"] == self.published_app.uuid

    def test_users_see_unpublished_apps_owned_by_their_org(self):
        self.get_success_response(self.unpublished_app.slug, status_code=200)

    def test_retrieving_internal_integrations_as_org_member(self):
        self.get_success_response(self.internal_integration.slug, status_code=200)

    def test_internal_integrations_are_not_public(self):
        # User not in Org who owns the Integration
        self.login_as(self.create_user())
        self.get_error_response(self.internal_integration.slug, status_code=404)

    def test_users_do_not_see_unowned_unpublished_apps(self):
        self.get_error_response(self.unowned_unpublished_app.slug, status_code=404)


@control_silo_test
class UpdateSentryAppDetailsTest(SentryAppDetailsTest):
    method = "PUT"

    def _validate_updated_published_app(self, response):
        data = response.data
        data["featureData"] = sorted(data["featureData"], key=lambda a: a["featureId"])

        assert data == {
            "name": self.published_app.name,
            "author": "A Company",
            "slug": self.published_app.slug,
            "scopes": [],
            "events": set(),
            "status": self.published_app.get_status_display(),
            "uuid": self.published_app.uuid,
            "webhookUrl": "https://newurl.com",
            "redirectUrl": "https://newredirecturl.com",
            "isAlertable": True,
            "verifyInstall": self.published_app.verify_install,
            "clientId": self.published_app.application.client_id,
            "clientSecret": self.published_app.application.client_secret,
            "overview": self.published_app.overview,
            "allowedOrigins": [],
            "schema": {},
            "owner": {"id": self.organization.id, "slug": self.organization.slug},
            "featureData": [
                {
                    "featureId": 1,
                    "featureGate": "integrations-issue-link",
                    "description": "Organizations can **create or link Sentry issues** to another service.",
                },
                {
                    "featureId": 2,
                    "featureGate": "integrations-stacktrace-link",
                    "description": "Organizations can **open a line to Sentry's stack trace** in another service.",
                },
            ],
            "popularity": self.popularity,
            "avatars": set(),
            "metadata": {},
        }

    def test_superuser_update_published_app(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            self.published_app.slug,
            name=self.published_app.name,
            author="A Company",
            webhookUrl="https://newurl.com",
            redirectUrl="https://newredirecturl.com",
            isAlertable=True,
            features=[1, 2],
            status_code=200,
        )

        self._validate_updated_published_app(response)

    def test_staff_update_published_app(self):
        with override_options({"staff.user-email-allowlist": [self.staff_user.email]}):
            self.login_as(user=self.staff_user, staff=True)
            response = self.get_success_response(
                self.published_app.slug,
                name=self.published_app.name,
                author="A Company",
                webhookUrl="https://newurl.com",
                redirectUrl="https://newredirecturl.com",
                isAlertable=True,
                features=[1, 2],
                status_code=200,
            )

        self._validate_updated_published_app(response)

    def test_update_unpublished_app(self):
        response = self.get_success_response(
            self.unpublished_app.slug,
            name="NewName",
            webhookUrl="https://newurl.com",
            scopes=("event:read",),
            events=("issue",),
            features=[1, 2],
            status_code=200,
        )

        assert response.data["name"] == "NewName"
        assert response.data["slug"] == self.unpublished_app.slug
        assert response.data["scopes"] == ["event:read"]
        assert response.data["events"] == {"issue"}
        assert response.data["uuid"] == self.unpublished_app.uuid
        assert response.data["webhookUrl"] == "https://newurl.com"
        assert sorted(response.data["featureData"], key=lambda a: a["featureId"]) == [
            {
                "featureId": 1,
                "featureGate": "integrations-issue-link",
                "description": "Organizations can **create or link Sentry issues** to another service.",
            },
            {
                "featureId": 2,
                "featureGate": "integrations-stacktrace-link",
                "description": "Organizations can **open a line to Sentry's stack trace** in another service.",
            },
        ]

    def test_can_update_name_with_non_unique_name(self):
        sentry_app = self.create_sentry_app(name="Foo Bar", organization=self.organization)
        deletions.exec_sync(sentry_app)
        self.get_success_response(
            self.published_app.slug,
            name=sentry_app.name,
            status_code=200,
        )

    def test_cannot_update_events_without_permissions(self):
        response = self.get_error_response(
            self.unpublished_app.slug,
            name="NewName",
            webhookUrl="https://newurl.com",
            scopes=("project:read",),
            events=("issue",),
            status_code=400,
        )
        assert response.data == {"events": ["issue webhooks require the event:read permission."]}

    def test_cannot_update_scopes_published_app(self):
        response = self.get_error_response(
            self.published_app.slug,
            name="NewName",
            webookUrl="https://newurl.com",
            scopes=("project:read",),
            status_code=400,
        )
        assert response.data["detail"] == "Cannot update permissions on a published integration."

    def test_cannot_update_features_published_app_permissions(self):
        response = self.get_error_response(
            self.published_app.slug,
            features=[1, 2, 3],
            status_code=400,
        )
        assert response.data["detail"] == "Cannot update features on a published integration."

    def test_cannot_update_non_owned_apps(self):
        app = self.create_sentry_app(name="SampleApp", organization=self.create_organization())
        self.get_error_response(
            app.slug,
            name="NewName",
            webookUrl="https://newurl.com",
            status_code=404,
        )

    def test_superuser_can_update_popularity(self):
        self.login_as(user=self.superuser, superuser=True)
        app = self.create_sentry_app(name="SampleApp", organization=self.organization)
        assert not app.date_published

        popularity = 100
        self.get_success_response(
            app.slug,
            popularity=popularity,
            status_code=200,
        )
        assert SentryApp.objects.get(id=app.id).popularity == popularity

    def test_staff_can_update_popularity(self):
        self.login_as(user=self.staff_user, staff=True)
        app = self.create_sentry_app(name="SampleApp", organization=self.organization)
        assert not app.date_published

        popularity = 100
        with override_options({"staff.user-email-allowlist": [self.staff_user.email]}):
            self.get_success_response(
                app.slug,
                popularity=popularity,
                status_code=200,
            )
        assert SentryApp.objects.get(id=app.id).popularity == popularity

    def test_nonsuperuser_nonstaff_cannot_update_popularity(self):
        app = self.create_sentry_app(
            name="SampleApp", organization=self.organization, popularity=self.popularity
        )
        self.get_success_response(
            app.slug,
            popularity=100,
            status_code=200,
        )
        assert SentryApp.objects.get(id=app.id).popularity == self.popularity

    def test_superuser_can_publish_apps(self):
        self.login_as(user=self.superuser, superuser=True)
        app = self.create_sentry_app(name="SampleApp", organization=self.organization)
        assert not app.date_published

        self.get_success_response(
            app.slug,
            status="published",
            status_code=200,
        )

        app.refresh_from_db()
        assert app.status == SentryAppStatus.PUBLISHED
        assert app.date_published

    def test_staff_can_publish_apps(self):
        self.login_as(user=self.staff_user, staff=True)
        app = self.create_sentry_app(name="SampleApp", organization=self.organization)
        assert not app.date_published

        with override_options({"staff.user-email-allowlist": [self.staff_user.email]}):
            self.get_success_response(
                app.slug,
                status="published",
                status_code=200,
            )

        app.refresh_from_db()
        assert app.status == SentryAppStatus.PUBLISHED
        assert app.date_published

    def test_nonsuperuser_nonstaff_cannot_publish_apps(self):
        app = self.create_sentry_app(name="SampleApp", organization=self.organization)
        self.get_success_response(
            app.slug,
            status="published",
            status_code=200,
        )

        assert SentryApp.objects.get(id=app.id).status == SentryAppStatus.UNPUBLISHED

    @with_feature({"organizations:integrations-event-hooks": False})
    def test_cannot_add_error_created_hook_without_flag(self):
        app = self.create_sentry_app(name="SampleApp", organization=self.organization)
        self.get_error_response(
            app.slug,
            events=["error"],
            status_code=403,
        )

    @with_feature("organizations:integrations-event-hooks")
    def test_can_add_error_created_hook_with_flag(self):
        app = self.create_sentry_app(name="SampleApp", organization=self.organization)
        self.get_success_response(
            app.slug,
            events=["error"],
            scopes=("event:read",),
            status_code=200,
        )

    def test_staff_can_mutate_scopes(self):
        self.login_as(user=self.staff_user, staff=True)
        app = self.create_sentry_app(
            name="SampleApp", organization=self.organization, scopes=("event:read",)
        )
        assert SentryApp.objects.get(id=app.id).get_scopes() == ["event:read"]

        # scopes is empty array which should not be treated as none
        self.get_success_response(
            app.slug,
            scopes=(),
            status_code=200,
        )
        assert SentryApp.objects.get(id=app.id).get_scopes() == []

        # update with hierarchy
        self.get_success_response(
            app.slug,
            scopes=("event:write",),
            status_code=200,
        )
        assert SentryApp.objects.get(id=app.id).get_scopes() == ["event:read", "event:write"]

    def test_remove_scopes(self):
        app = self.create_sentry_app(
            name="SampleApp", organization=self.organization, scopes=("event:read",)
        )
        assert SentryApp.objects.get(id=app.id).get_scopes() == ["event:read"]

        # scopes is empty array which should not be treated as none
        self.get_success_response(
            app.slug,
            scopes=(),
            status_code=200,
        )
        assert SentryApp.objects.get(id=app.id).get_scopes() == []

    def test_keep_scope_unchanged(self):
        app = self.create_sentry_app(
            name="SampleApp", organization=self.organization, scopes=("event:read",)
        )

        # scopes is None here
        self.get_success_response(
            app.slug,
            status_code=200,
        )
        assert SentryApp.objects.get(id=app.id).get_scopes() == ["event:read"]

    def test_updating_scopes_maintains_scope_hierarchy(self):
        app = self.create_sentry_app(
            name="SampleApp", organization=self.organization, scopes=["event:read", "event:write"]
        )

        self.get_success_response(
            app.slug,
            scopes=("event:write",),
            status_code=200,
        )
        assert SentryApp.objects.get(id=app.id).get_scopes() == ["event:read", "event:write"]

    @patch("sentry.analytics.record")
    def test_bad_schema(self, record):
        app = self.create_sentry_app(name="SampleApp", organization=self.organization)
        schema = {"bad_key": "bad_value"}

        response = self.get_error_response(
            app.slug,
            schema=schema,
            status_code=400,
        )

        assert response.data == {"schema": ["'elements' is a required property"]}
        record.assert_called_with(
            "sentry_app.schema_validation_error",
            user_id=self.user.id,
            organization_id=self.organization.id,
            sentry_app_id=app.id,
            sentry_app_name="SampleApp",
            error_message="'elements' is a required property",
            schema=json.dumps(schema),
        )

    def test_no_webhook_public_integration(self):
        response = self.get_error_response(
            self.published_app.slug,
            webhookUrl="",
            status_code=400,
        )
        assert response.data == {"webhookUrl": ["webhookUrl required for public integrations"]}

    def test_no_webhook_has_events(self):
        response = self.get_error_response(
            self.internal_integration.slug, webhookUrl="", events=("issue",), status_code=400
        )
        assert response.data == {
            "webhookUrl": ["webhookUrl required if webhook events are enabled"]
        }

    def test_no_webhook_has_alerts(self):
        # make sure we test at least one time with the webhookUrl set to none before the put request
        self.internal_integration.webhook_url = None
        self.internal_integration.save()

        response = self.get_error_response(
            self.internal_integration.slug, isAlertable=True, status_code=400
        )
        assert response.data == {
            "webhookUrl": ["webhookUrl required if alert rule action is enabled"]
        }

    def test_set_allowed_origins(self):
        self.get_success_response(
            self.published_app.slug,
            allowedOrigins=["google.com", "sentry.io"],
            status_code=200,
        )
        assert self.published_app.application.get_allowed_origins() == ["google.com", "sentry.io"]

    def test_allowed_origins_with_star(self):
        response = self.get_error_response(
            self.published_app.slug,
            allowedOrigins=["*.google.com"],
            status_code=400,
        )
        assert response.data == {"allowedOrigins": ["'*' not allowed in origin"]}

    def test_members_cant_update(self):
        with assume_test_silo_mode(SiloMode.REGION):
            # create extra owner because we are demoting one
            self.create_member(
                organization=self.organization, user=self.create_user(), role="owner"
            )

            member_om = OrganizationMember.objects.get(
                user_id=self.user.id, organization=self.organization
            )
            member_om.role = "member"
            member_om.save()

        self.get_error_response(
            self.unpublished_app.slug,
            scopes=("member:read",),
            status_code=403,
        )

    def test_create_integration_exceeding_scopes(self):
        with assume_test_silo_mode(SiloMode.REGION):
            # create extra owner because we are demoting one
            self.create_member(
                organization=self.organization, user=self.create_user(), role="owner"
            )

            member_om = OrganizationMember.objects.get(
                user_id=self.user.id, organization=self.organization
            )
            member_om.role = "manager"
            member_om.save()

        response = self.get_error_response(
            self.unpublished_app.slug,
            scopes=("org:read", "org:write", "org:admin"),
            status_code=400,
        )

        assert response.data == {
            "scopes": [
                "Requested permission of org:admin exceeds requester's permission. Please contact an administrator to make the requested change.",
            ]
        }

    def test_cannot_update_partner_apps(self):
        self.published_app.update(metadata={"partnership_restricted": True})
        self.get_error_response(
            self.published_app.slug,
            name="A Company",
            webhookUrl="https://newurl.com",
            redirectUrl="https://newredirecturl.com",
            isAlertable=True,
            status_code=403,
        )


@control_silo_test
class DeleteSentryAppDetailsTest(SentryAppDetailsTest):
    method = "DELETE"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.superuser, superuser=True)

    def test_staff_cannot_delete_unpublished_app(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(staff_user, staff=False)
        response = self.get_error_response(
            self.unpublished_app.slug,
            status_code=404,
        )
        assert response.data["detail"] == "Not found."

        assert not AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SENTRY_APP_REMOVE")
        ).exists()

    @patch("sentry.analytics.record")
    def test_superuser_delete_unpublished_app(self, record):
        self.get_success_response(
            self.unpublished_app.slug,
            status_code=204,
        )

        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SENTRY_APP_REMOVE")
        ).exists()
        record.assert_called_with(
            "sentry_app.deleted",
            user_id=self.superuser.id,
            organization_id=self.organization.id,
            sentry_app=self.unpublished_app.slug,
        )

    def test_superuser_delete_unpublished_app_with_installs(self):
        installation = self.create_sentry_app_installation(
            organization=self.organization,
            slug=self.unpublished_app.slug,
            user=self.user,
        )

        self.get_success_response(
            self.unpublished_app.slug,
            status_code=204,
        )

        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SENTRY_APP_REMOVE")
        ).exists()
        assert not SentryAppInstallation.objects.filter(id=installation.id).exists()

    def test_superuser_cannot_delete_published_app(self):
        response = self.get_error_response(self.published_app.slug, status_code=403)
        assert response.data == {"detail": ["Published apps cannot be removed."]}

    def test_superuser_cannot_delete_partner_apps(self):
        self.published_app.update(metadata={"partnership_restricted": True})
        response = self.get_error_response(
            self.published_app.slug,
            status_code=403,
        )
        assert response.data["detail"] == PARTNERSHIP_RESTRICTED_ERROR_MESSAGE

    def test_cannot_delete_by_manager(self):
        self.user_manager = self.create_user("manager@example.com", is_superuser=False)
        self.create_member(
            user=self.user_manager, organization=self.organization, role="manager", teams=[]
        )
        self.login_as(self.user_manager)

        self.get_error_response(self.internal_integration.slug, status_code=403)
