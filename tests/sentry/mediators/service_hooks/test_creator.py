from __future__ import absolute_import

from sentry.mediators.service_hooks import Creator
from sentry.mediators.service_hooks.creator import expand_events, consolidate_events
from sentry.models import ServiceHook, ServiceHookProject
from sentry.testutils import TestCase


class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(name="foo", organization=self.org)
        self.sentry_app = self.create_sentry_app(owner=self.org)
        self.creator = Creator(
            application=self.sentry_app.application,
            actor=self.sentry_app.proxy_user,
            organization=self.org,
            projects=[],
            events=("event.created",),
            url=self.sentry_app.webhook_url,
        )

    def test_creates_service_hook(self):
        self.creator.call()

        service_hook = ServiceHook.objects.get(
            application=self.sentry_app.application,
            actor_id=self.sentry_app.proxy_user.id,
            url=self.sentry_app.webhook_url,
        )

        assert service_hook
        assert service_hook.events == ["event.created"]
        hook_project = ServiceHookProject.objects.get(project_id=self.project.id)
        assert hook_project.service_hook_id == service_hook.id
        assert not service_hook.project_id

    def test_expands_resource_events_to_specific_events(self):
        self.creator.events = ["issue"]
        service_hook = self.creator.call()

        assert set(service_hook.events) == set(
            ["issue.created", "issue.resolved", "issue.ignored", "issue.assigned"]
        )

    def test_expand_events(self):
        assert expand_events(["issue"]) == set(
            ["issue.created", "issue.resolved", "issue.ignored", "issue.assigned"]
        )

    def test_consolidate_events(self):
        assert consolidate_events(["issue.created"]) == set(["issue"])
