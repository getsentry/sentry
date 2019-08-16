from __future__ import absolute_import

from sentry.mediators.service_hooks import Updater
from sentry.testutils import TestCase


class TestUpdater(TestCase):
    def setUp(self):
        self.sentry_app = self.create_sentry_app()
        self.service_hook = self.create_service_hook(application=self.sentry_app.application)

        self.updater = Updater(service_hook=self.service_hook)

    def test_updates_application(self):
        app = self.create_sentry_app(name="Blah").application
        self.updater.application = app
        self.updater.call()
        assert self.service_hook.application == app

    def test_updates_actor(self):
        actor = self.create_user(email="hello@yahoo.com")
        self.updater.actor = actor
        self.updater.call()
        assert self.service_hook.actor_id == actor.id

    def test_updates_events(self):
        self.updater.events = ("event.alert",)
        self.updater.call()
        assert self.service_hook.events == ["event.alert"]

    def test_updates_url(self):
        self.updater.url = "http://example.com/hooks"
        self.updater.call()
        assert self.service_hook.url == "http://example.com/hooks"
