from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.coreapi import APIError
from sentry.constants import SentryAppStatus
from sentry.mediators.sentry_apps import Updater
from sentry.mediators.service_hooks.creator import expand_events
from sentry.models import SentryAppComponent, ServiceHook, ApiToken
from sentry.testutils import TestCase


class TestUpdater(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.sentry_app = self.create_sentry_app(
            name="nulldb",
            organization=self.org,
            scopes=("project:read",),
            schema={"elements": [self.create_issue_link_schema()]},
        )
        self.updater = Updater(sentry_app=self.sentry_app, user=self.user)

    def test_updates_name(self):
        self.updater.name = "A New Thing"
        self.updater.call()
        assert self.sentry_app.name == "A New Thing"

    def test_update_scopes_internal_integration(self):
        self.create_project(organization=self.org)
        sentry_app = self.create_internal_integration(
            scopes=("project:read",), organization=self.org
        )
        updater = Updater(sentry_app=sentry_app, user=self.user)
        updater.scopes = ("project:read", "project:write")
        updater.call()
        assert sentry_app.get_scopes() == ["project:read", "project:write"]
        assert ApiToken.objects.get(application=sentry_app.application).get_scopes() == [
            "project:read",
            "project:write",
        ]

    def test_updates_unpublished_app_scopes(self):
        # create both expired token and not expired tokens
        ApiToken.objects.create(
            application=self.sentry_app.application,
            user=self.sentry_app.proxy_user,
            scopes=self.sentry_app.scopes,
            scope_list=self.sentry_app.scope_list,
            expires_at=(timezone.now() + timedelta(hours=1)),
        )
        ApiToken.objects.create(
            application=self.sentry_app.application,
            user=self.sentry_app.proxy_user,
            scopes=self.sentry_app.scopes,
            scope_list=self.sentry_app.scope_list,
            expires_at=(timezone.now() - timedelta(hours=1)),
        )
        self.updater.scopes = ("project:read", "project:write")
        self.updater.call()
        assert self.sentry_app.get_scopes() == ["project:read", "project:write"]
        tokens = ApiToken.objects.filter(application=self.sentry_app.application).order_by(
            "expires_at"
        )
        assert tokens[0].get_scopes() == ["project:read"]
        assert tokens[1].get_scopes() == ["project:read", "project:write"]

    def test_doesnt_update_published_app_scopes(self):
        sentry_app = self.create_sentry_app(
            name="sentry", organization=self.org, scopes=("project:read",), published=True
        )
        updater = Updater(sentry_app=sentry_app, user=self.user)
        updater.scopes = ("project:read", "project:write")

        with self.assertRaises(APIError):
            updater.call()

    def test_update_webhook_published_app(self):
        sentry_app = self.create_sentry_app(
            name="sentry", organization=self.org, scopes=("project:read",), published=True
        )
        updater = Updater(sentry_app=sentry_app, user=self.user)
        # pass in scopes but as the same value
        updater.scopes = ["project:read"]
        updater.webhook_url = "http://example.com/hooks"
        updater.call()
        assert sentry_app.webhook_url == "http://example.com/hooks"

    def test_doesnt_update_app_with_invalid_event_permissions(self):
        sentry_app = self.create_sentry_app(
            name="sentry", organization=self.org, scopes=("project:read",)
        )
        updater = Updater(sentry_app=sentry_app, user=self.user)
        updater.events = ("issue",)
        with self.assertRaises(APIError):
            updater.call()

    def test_doesnt_update_verify_install_if_internal(self):
        self.create_project(organization=self.org)
        sentry_app = self.create_internal_integration(name="Internal", organization=self.org)
        updater = Updater(sentry_app=sentry_app, user=self.user)
        updater.verify_install = True
        with self.assertRaises(APIError):
            updater.call()

    def test_updates_service_hook_events(self):
        sentry_app = self.create_sentry_app(
            name="sentry",
            organization=self.org,
            scopes=("project:read", "event:read"),
            events=("event.alert",),
        )
        self.create_sentry_app_installation(slug="sentry")
        updater = Updater(sentry_app=sentry_app, events=("issue",), user=self.user)
        updater.call()
        assert set(sentry_app.events) == expand_events(["issue"])
        service_hook = ServiceHook.objects.filter(application=sentry_app.application)[0]
        assert set(service_hook.events) == expand_events(["issue"])

    def test_updates_webhook_url(self):
        sentry_app = self.create_sentry_app(
            name="sentry",
            organization=self.org,
            scopes=("project:read", "event:read"),
            events=("event.alert",),
        )
        self.create_sentry_app_installation(slug="sentry")
        updater = Updater(
            sentry_app=sentry_app, webhook_url="http://example.com/hooks", user=self.user
        )
        updater.call()
        assert sentry_app.webhook_url == "http://example.com/hooks"
        service_hook = ServiceHook.objects.get(application=sentry_app.application)
        assert service_hook.url == "http://example.com/hooks"
        assert set(service_hook.events) == expand_events(["event.alert"])

    def test_updates_redirect_url(self):
        self.updater.redirect_url = "http://example.com/finish-setup"
        self.updater.call()
        assert self.sentry_app.redirect_url == "http://example.com/finish-setup"

    def test_updates_is_alertable(self):
        self.updater.is_alertable = True
        self.updater.call()
        assert self.sentry_app.is_alertable

    def test_updates_schema(self):
        ui_component = SentryAppComponent.objects.get(sentry_app_id=self.sentry_app.id)
        self.updater.schema = {"elements": [self.create_alert_rule_action_schema()]}
        self.updater.call()
        new_ui_component = SentryAppComponent.objects.get(sentry_app_id=self.sentry_app.id)
        assert not ui_component.type == new_ui_component.type
        assert self.sentry_app.schema == {"elements": [self.create_alert_rule_action_schema()]}

    def test_updates_overview(self):
        self.updater.overview = "Description of my very cool application"
        self.updater.call()
        assert self.sentry_app.overview == "Description of my very cool application"

    def test_update_status_if_superuser(self):
        self.updater.status = "published"
        self.user.is_superuser = True
        self.updater.call()
        assert self.sentry_app.status == SentryAppStatus.PUBLISHED

    def test_doesnt_update_status_if_not_superuser(self):
        self.updater.status = "published"
        self.updater.call()
        assert self.sentry_app.status == SentryAppStatus.UNPUBLISHED

    def test_create_service_hook_on_update(self):
        self.create_project(organization=self.org)
        internal_app = self.create_internal_integration(
            name="Internal", organization=self.org, webhook_url=None, scopes=("event:read",)
        )
        assert len(ServiceHook.objects.filter(application=internal_app.application)) == 0
        updater = Updater(sentry_app=internal_app, user=self.user)
        updater.webhook_url = "https://sentry.io/hook"
        updater.events = ("issue",)
        updater.call()
        service_hook = ServiceHook.objects.get(application=internal_app.application)
        assert service_hook.url == "https://sentry.io/hook"
        assert set(service_hook.events) == expand_events(["issue"])

    def test_delete_service_hook_on_update(self):
        self.create_project(organization=self.org)
        internal_app = self.create_internal_integration(
            name="Internal", organization=self.org, webhook_url="https://sentry.io/hook"
        )
        assert len(ServiceHook.objects.filter(application=internal_app.application)) == 1
        updater = Updater(sentry_app=internal_app, user=self.user)
        updater.webhook_url = ""
        updater.call()
        assert len(ServiceHook.objects.filter(application=internal_app.application)) == 0
