from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.constants import SentryAppStatus
from sentry.models import SentryApp, OrganizationMember
from sentry.testutils import APITestCase
from sentry.testutils.helpers import Feature, with_feature
from sentry.utils import json
from sentry.utils.compat.mock import patch


class SentryAppDetailsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.super_org = self.create_organization(owner=self.superuser)
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

        self.internal_integration = self.create_internal_integration(organization=self.org)

        self.url = reverse("sentry-api-0-sentry-app-details", args=[self.published_app.slug])


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
            },
            format="json",
        )
        assert json.loads(response.content) == {
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
                    "description": "Test can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).",
                    "featureGate": "integrations-api",
                }
            ],
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
            },
            format="json",
        )

        assert response.status_code == 200
        assert response.data["name"] == "NewName"
        assert response.data["slug"] == slug
        assert response.data["scopes"] == ["event:read"]
        assert response.data["events"] == set(["issue"])
        assert response.data["uuid"] == self.unpublished_app.uuid
        assert response.data["webhookUrl"] == "https://newurl.com"

    def test_can_update_name_with_non_unique_name(self):
        from sentry.mediators import sentry_apps

        self.login_as(user=self.user)
        sentry_app = self.create_sentry_app(name="Foo Bar", organization=self.org)

        sentry_apps.Destroyer.run(sentry_app=sentry_app, user=self.user)

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

    def test_cannot_update_non_owned_apps(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="SampleApp", organization=self.super_org)
        url = reverse("sentry-api-0-sentry-app-details", args=[app.slug])
        response = self.client.put(
            url, data={"name": "NewName", "webhookUrl": "https://newurl.com"}, format="json"
        )
        assert response.status_code == 404

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

    def test_create_integration_exceeding_scopes(self):
        member_om = OrganizationMember.objects.get(user=self.user, organization=self.org)
        member_om.role = "member"
        member_om.save()
        self.login_as(user=self.user)
        url = reverse("sentry-api-0-sentry-app-details", args=[self.unpublished_app.slug])
        response = self.client.put(
            url, data={"scopes": ["member:read", "member:write", "member:admin"]}
        )

        assert response.status_code == 400
        assert response.data == {
            "scopes": [
                "Requested permission of member:write exceeds requester's permission. Please contact an administrator to make the requested change.",
                "Requested permission of member:admin exceeds requester's permission. Please contact an administrator to make the requested change.",
            ]
        }


class DeleteSentryAppDetailsTest(SentryAppDetailsTest):
    def test_delete_unpublished_app(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-sentry-app-details", args=[self.unpublished_app.slug])
        response = self.client.delete(url)
        assert response.status_code == 204

    def test_cannot_delete_published_app(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-sentry-app-details", args=[self.published_app.slug])
        response = self.client.delete(url)
        assert response.status_code == 403
        assert response.data == {"detail": ["Published apps cannot be removed."]}
