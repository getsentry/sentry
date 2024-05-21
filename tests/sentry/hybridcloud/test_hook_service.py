from sentry.models.integrations.sentry_app import EVENT_EXPANSION
from sentry.models.servicehook import ServiceHook
from sentry.sentry_apps.apps import consolidate_events, expand_events
from sentry.services.hybrid_cloud.hook import RpcServiceHook, hook_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


@all_silo_test
class TestHookService(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(name="foo", organization=self.org)
        self.sentry_app = self.create_sentry_app(organization_id=self.org.id)

    def call_create_hook(
        self, project_ids: list[int] | None = None, events: list[str] | None = None
    ) -> RpcServiceHook:
        events = events or ["event.created"]
        return hook_service.create_service_hook(
            application_id=self.sentry_app.application.id,
            actor_id=self.sentry_app.proxy_user.id,
            organization_id=self.org.id,
            project_ids=project_ids,
            events=events,
            url=self.sentry_app.webhook_url,
        )

    def test_creates_service_hook(self) -> None:
        self.call_create_hook()

        with assume_test_silo_mode(SiloMode.REGION):
            service_hook = ServiceHook.objects.get(
                application_id=self.sentry_app.application_id,
                actor_id=self.sentry_app.proxy_user.id,
                url=self.sentry_app.webhook_url,
            )

        assert service_hook
        assert service_hook.events == ["event.created"]

    def test_expands_resource_events_to_specific_events(self) -> None:
        service_hook = self.call_create_hook(events=["issue"])
        assert set(service_hook.events) == set(EVENT_EXPANSION["issue"])

    def test_expand_events(self) -> None:
        assert expand_events(["issue"]) == set(EVENT_EXPANSION["issue"])

    def test_consolidate_events(self) -> None:
        assert consolidate_events(["issue.created"]) == {"issue"}
