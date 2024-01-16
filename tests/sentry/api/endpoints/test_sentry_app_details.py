from unittest.mock import patch

from django.urls import reverse

from sentry import audit_log, deletions
from sentry.constants import SentryAppStatus
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.organizationmember import OrganizationMember
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature, with_feature
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json


class SentryAppDetailsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.super_org = self.create_organization(owner=self.superuser)
        self.popularity = 27
        self.published_app = self.create_sentry_app(
            name="Test",
            organization=self.org,
            published=True,
            popularity=self.popularity,
        )

        self.unpublished_app = self.create_sentry_app(
            name="Testin",
            organization=self.org,
            popularity=self.popularity,
        )

        self.unowned_unpublished_app = self.create_sentry_app(
            name="Nosee",
            organization=self.create_organization(),
            scopes=(),
            webhook_url="https://example.com",
            popularity=self.popularity,
        )

        self.internal_integration = self.create_internal_integration(organization=self.org)

        self.url = reverse("sentry-api-0-sentry-app-details", args=[self.published_app.slug])


@control_silo_test
class GetSentryAppDetailsTest(SentryAppDetailsTest):
    def test_superuser_sees_all_apps(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200
        assert response.data["uuid"] == self.published_app.uuid

        url = reverse("sentry-api-0-sentry-app-details", args=[self.unpublished_app.slug])

        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["uuid"] == self.unpublished_app.uuid

    def test_users_see_published_app(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format="json")
        assert response.status_code == 200
        assert response.data["uuid"] == self.published_app.uuid

    def test_users_see_unpublished_apps_owned_by_their_org(self):
        self.login_as(self.user)

        url = reverse("sentry-api-0-sentry-app-details", args=[self.unpublished_app.slug])

        response = self.client.get(url, format="json")
        assert response.status_code == 200

    def test_retrieving_internal_integrations_as_org_member(self):
        self.login_as(self.user)

        url = reverse("sentry-api-0-sentry-app-details", args=[self.internal_integration.slug])

        response = self.client.get(url, format="json")
        assert response.status_code == 200

    def test_internal_integrations_are_not_public(self):
        # User not in Org who owns the Integration
        self.login_as(self.create_user())

        url = reverse("sentry-api-0-sentry-app-details", args=[self.internal_integration.slug])

        response = self.client.get(url, format="json")
        assert response.status_code == 404

    def test_users_do_not_see_unowned_unpublished_apps(self):
        self.login_as(self.user)

        url = reverse("sentry-api-0-sentry-app-details", args=[self.unowned_unpublished_app.slug])

        response = self.client.get(url, format="json")
        assert response.status_code == 404


@control_silo_test
class UpdateSentryAppDetailsTest(SentryAppDetailsTest):
    def test_update_published_app(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.put(
            self.url,
            data={
                "name": self.published_app.name,
                "author": "A Company",
                "webhookUrl": "https://newurl.com",
                "redirectUrl": "https://newredirecturl.com",
                "isAlertable": True,
                "features": [1, 2],
            },
            format="json",
        )

        data = json.loads(response.content)
        data["featureData"] = sorted(data["featureData"], key=lambda a: a["featureId"])

        assert data == {
            "name": self.published_app.name,
            "author": "A Company",
            "slug": self.published_app.slug,
            "scopes": [],
            "events": [],
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
            "owner": {"id": self.org.id, "slug": self.org.slug},
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
            "avatars": [],
            "metadata": {},
        }

    def test_update_unpublished_app(self):
        self.login_as(user=self.user)
        slug = self.unpublished_app.slug
        url = reverse("sentry-api-0-sentry-app-details", args=[self.unpublished_app.slug])

        response = self.client.put(
            url,
            data={
                "name": "NewName",
                "webhookUrl": "https://newurl.com",
                "scopes": ("event:read",),
                "events": ("issue",),
                "features": [1, 2],
            },
            format="json",
        )

        assert response.status_code == 200
        assert response.data["name"] == "NewName"
        assert response.data["slug"] == slug
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
        self.login_as(user=self.user)
        sentry_app = self.create_sentry_app(name="Foo Bar", organization=self.org)

        deletions.exec_sync(sentry_app)

        response = self.client.put(self.url, data={"name": sentry_app.name}, format="json")
        assert response.status_code == 200

    def test_cannot_update_events_without_permissions(self):
        self.login_as(user=self.user)
        url = reverse("sentry-api-0-sentry-app-details", args=[self.unpublished_app.slug])

        response = self.client.put(
            url,
            data={
                "name": "NewName",
                "webhookUrl": "https://newurl.com",
                "scopes": ("project:read",),
                "events": ("issue",),
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data == {"events": ["issue webhooks require the event:read permission."]}

    def test_cannot_update_scopes_published_app(self):
        self.login_as(user=self.user)

        response = self.client.put(
            self.url,
            data={
                "name": "NewName",
                "webhookUrl": "https://newurl.com",
                "scopes": ("project:read",),
            },
            format="json",
        )
        assert response.status_code == 400
        assert response.data["detail"] == "Cannot update permissions on a published integration."

    def test_cannot_update_features_published_app_permissions(self):
        self.login_as(user=self.user)

        response = self.client.put(
            self.url,
            data={"features": [1, 2, 3]},
            format="json",
        )
        assert response.status_code == 400
        assert response.data["detail"] == "Cannot update features on a published integration."

    def test_cannot_update_non_owned_apps(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="SampleApp", organization=self.super_org)
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        response = self.client.put(
            url, data={"name": "NewName", "webhookUrl": "https://newurl.com"}, format="json"
        )
        assert response.status_code == 404

    def test_superusers_can_update_popularity(self):
        self.login_as(user=self.superuser, superuser=True)
        app = self.create_sentry_app(name="SampleApp", organization=self.org)
        assert not app.date_published
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        popularity = 100
        response = self.client.put(url, data={"popularity": popularity}, format="json")
        assert response.status_code == 200
        assert SentryApp.objects.get(id=app.id).popularity == popularity

    def test_nonsuperusers_cannot_update_popularity(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(
            name="SampleApp", organization=self.org, popularity=self.popularity
        )
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        response = self.client.put(url, data={"popularity": 100}, format="json")
        assert response.status_code == 200
        assert SentryApp.objects.get(id=app.id).popularity == self.popularity

    def test_superusers_can_publish_apps(self):
        self.login_as(user=self.superuser, superuser=True)
        app = self.create_sentry_app(name="SampleApp", organization=self.org)
        assert not app.date_published
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        response = self.client.put(url, data={"status": "published"}, format="json")
        assert response.status_code == 200
        app = SentryApp.objects.get(id=app.id)
        assert app.status == SentryAppStatus.PUBLISHED
        assert app.date_published

    def test_nonsuperusers_cannot_publish_apps(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="SampleApp", organization=self.org)
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        response = self.client.put(url, data={"status": "published"}, format="json")
        assert response.status_code == 200
        assert SentryApp.objects.get(id=app.id).status == SentryAppStatus.UNPUBLISHED

    def test_cannot_add_error_created_hook_without_flag(self):
        self.login_as(user=self.user)
        with Feature({"organizations:integrations-event-hooks": False}):
            app = self.create_sentry_app(name="SampleApp", organization=self.org)
            url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
            response = self.client.put(url, data={"events": ("error",)}, format="json")
            assert response.status_code == 403

    @with_feature("organizations:integrations-event-hooks")
    def test_can_add_error_created_hook_with_flag(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="SampleApp", organization=self.org)
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        response = self.client.put(
            url, data={"events": ("error",), "scopes": ("event:read",)}, format="json"
        )
        assert response.status_code == 200

    def test_remove_scopes(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(
            name="SampleApp", organization=self.org, scopes=("event:read",)
        )
        assert SentryApp.objects.get(id=app.id).get_scopes() == ["event:read"]
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        # scopes is empty array which should not be treated as none
        response = self.client.put(url, data={"scopes": ()}, format="json")
        assert response.status_code == 200
        assert SentryApp.objects.get(id=app.id).get_scopes() == []

    def test_keep_scope_unchanged(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(
            name="SampleApp", organization=self.org, scopes=("event:read",)
        )
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        # scopes is None here
        response = self.client.put(url, data={}, format="json")
        assert response.status_code == 200
        assert SentryApp.objects.get(id=app.id).get_scopes() == ["event:read"]

    def test_updating_scopes_maintains_scope_hierarchy(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(
            name="SampleApp", organization=self.org, scopes=["event:read", "event:write"]
        )
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        response = self.client.put(url, data={"scopes": ["event:write"]}, format="json")
        assert response.status_code == 200
        assert SentryApp.objects.get(id=app.id).get_scopes() == ["event:read", "event:write"]

    @patch("sentry.analytics.record")
    def test_bad_schema(self, record):
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="SampleApp", organization=self.org)
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        schema = {"bad_key": "bad_value"}
        response = self.client.put(url, data={"schema": schema}, format="json")
        assert response.status_code == 400
        assert response.data == {"schema": ["'elements' is a required property"]}
        record.assert_called_with(
            "sentry_app.schema_validation_error",
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app_id=app.id,
            sentry_app_name="SampleApp",
            error_message="'elements' is a required property",
            schema=json.dumps(schema),
        )

    def test_no_webhook_public_integration(self):
        self.login_as(user=self.user)
        response = self.client.put(self.url, data={"webhookUrl": ""}, format="json")
        assert response.status_code == 400
        assert response.data == {"webhookUrl": ["webhookUrl required for public integrations"]}

    def test_no_webhook_has_events(self):
        self.login_as(user=self.user)
        url = reverse("sentry-api-0-sentry-app-details", args=[self.internal_integration.slug])
        response = self.client.put(
            url, data={"webhookUrl": "", "events": ("issue",)}, format="json"
        )
        assert response.status_code == 400
        assert response.data == {
            "webhookUrl": ["webhookUrl required if webhook events are enabled"]
        }

    def test_no_webhook_has_alerts(self):
        self.login_as(user=self.user)
        # make sure we test at least one time with the webhookUrl set to none before the put request
        self.internal_integration.webhook_url = None
        self.internal_integration.save()
        url = reverse("sentry-api-0-sentry-app-details", args=[self.internal_integration.slug])
        response = self.client.put(url, data={"isAlertable": True}, format="json")
        assert response.status_code == 400
        assert response.data == {
            "webhookUrl": ["webhookUrl required if alert rule action is enabled"]
        }

    def test_set_allowed_origins(self):
        self.login_as(user=self.user)
        response = self.client.put(
            self.url, data={"allowedOrigins": ["google.com", "sentry.io"]}, format="json"
        )
        assert response.status_code == 200
        assert self.published_app.application.get_allowed_origins() == ["google.com", "sentry.io"]

    def test_allowed_origins_with_star(self):
        self.login_as(user=self.user)
        response = self.client.put(
            self.url, data={"allowedOrigins": ["*.google.com"]}, format="json"
        )
        assert response.status_code == 400
        assert response.data == {"allowedOrigins": ["'*' not allowed in origin"]}

    def test_members_cant_update(self):
        with assume_test_silo_mode(SiloMode.REGION):
            # create extra owner because we are demoting one
            self.create_member(organization=self.org, user=self.create_user(), role="owner")

            member_om = OrganizationMember.objects.get(user_id=self.user.id, organization=self.org)
            member_om.role = "member"
            member_om.save()
        self.login_as(user=self.user)
        url = reverse("sentry-api-0-sentry-app-details", args=[self.unpublished_app.slug])
        response = self.client.put(url, data={"scopes": ["member:read"]})
        assert response.status_code == 403

    def test_create_integration_exceeding_scopes(self):
        with assume_test_silo_mode(SiloMode.REGION):
            # create extra owner because we are demoting one
            self.create_member(organization=self.org, user=self.create_user(), role="owner")

            member_om = OrganizationMember.objects.get(user_id=self.user.id, organization=self.org)
            member_om.role = "manager"
            member_om.save()
        self.login_as(user=self.user)
        url = reverse("sentry-api-0-sentry-app-details", args=[self.unpublished_app.slug])
        response = self.client.put(url, data={"scopes": ["org:read", "org:write", "org:admin"]})

        assert response.status_code == 400
        assert response.data == {
            "scopes": [
                "Requested permission of org:admin exceeds requester's permission. Please contact an administrator to make the requested change.",
            ]
        }

    def test_cannot_update_partner_apps(self):
        self.login_as(user=self.user)
        self.published_app.update(metadata={"partnership_restricted": True})
        response = self.client.put(
            self.url,
            data={
                "name": self.published_app.name,
                "author": "A Company",
                "webhookUrl": "https://newurl.com",
                "redirectUrl": "https://newredirecturl.com",
                "isAlertable": True,
            },
            format="json",
        )
        assert response.status_code == 403


@control_silo_test
class DeleteSentryAppDetailsTest(SentryAppDetailsTest):
    @patch("sentry.analytics.record")
    def test_delete_unpublished_app(self, record):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-sentry-app-details", args=[self.unpublished_app.slug])
        response = self.client.delete(url)
        assert response.status_code == 204
        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SENTRY_APP_REMOVE")
        ).exists()
        record.assert_called_with(
            "sentry_app.deleted",
            user_id=self.superuser.id,
            organization_id=self.org.id,
            sentry_app=self.unpublished_app.slug,
        )

    def test_delete_unpublished_app_with_installs(self):
        installation = self.create_sentry_app_installation(
            organization=self.organization,
            slug=self.unpublished_app.slug,
            user=self.user,
        )
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-sentry-app-details", args=[self.unpublished_app.slug])
        response = self.client.delete(url)
        assert response.status_code == 204

        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SENTRY_APP_REMOVE")
        ).exists()
        assert not SentryAppInstallation.objects.filter(id=installation.id).exists()

    def test_cannot_delete_published_app(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-sentry-app-details", args=[self.published_app.slug])
        response = self.client.delete(url)
        assert response.status_code == 403
        assert response.data == {"detail": ["Published apps cannot be removed."]}

    def test_cannot_delete_partner_apps(self):
        self.login_as(user=self.user)
        self.published_app.update(metadata={"partnership_restricted": True})
        response = self.client.delete(self.url)
        assert response.status_code == 403

    def test_cannot_delete_by_manager(self):
        self.user_manager = self.create_user("manager@example.com", is_superuser=False)
        self.create_member(user=self.user_manager, organization=self.org, role="manager", teams=[])
        self.login_as(self.user_manager)

        url = reverse("sentry-api-0-sentry-app-details", args=[self.internal_integration.slug])
        response = self.client.delete(url)
        assert response.status_code == 403
