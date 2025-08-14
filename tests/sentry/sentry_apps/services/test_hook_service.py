from sentry.sentry_apps.logic import consolidate_events, expand_events
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.sentry_apps.services.hook import RpcServiceHook, hook_service
from sentry.sentry_apps.utils.webhooks import EVENT_EXPANSION, SentryAppResourceType
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


@all_silo_test
class TestHookService(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(name="foo", organization=self.org)
        self.sentry_app = self.create_sentry_app(
            organization_id=self.org.id, events=["issue.created"]
        )

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
        assert service_hook.events == EVENT_EXPANSION[SentryAppResourceType.ISSUE]

    def test_expand_events(self) -> None:
        assert expand_events(["issue"]) == EVENT_EXPANSION[SentryAppResourceType.ISSUE]

    def test_expand_events_multiple(self) -> None:
        ret = expand_events(["unrelated", "issue", "comment", "unrelated"])
        assert ret == [
            "comment.created",
            "comment.deleted",
            "comment.updated",
            "issue.assigned",
            "issue.created",
            "issue.ignored",
            "issue.resolved",
            "issue.unresolved",
            "unrelated",
        ]

    def test_consolidate_events(self) -> None:
        assert consolidate_events(["issue.created"]) == {"issue"}

    def test_update_webhook_and_events_with_webhook_url(self) -> None:
        installation1 = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.org, user=self.user
        )
        installation2 = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.org, user=self.user
        )
        with assume_test_silo_mode(SiloMode.REGION):
            hook1 = ServiceHook.objects.get(
                installation_id=installation1.id, application_id=self.sentry_app.application.id
            )
            hook2 = ServiceHook.objects.get(
                installation_id=installation2.id, application_id=self.sentry_app.application.id
            )
            ServiceHook.objects.filter(application_id=self.sentry_app.application.id).update(
                events=["comment.created"]
            )

        # Call the update method
        result = hook_service.update_webhook_and_events(
            organization_id=self.org.id,
            application_id=self.sentry_app.application.id,
            webhook_url=self.sentry_app.webhook_url,
            events=self.sentry_app.events,
        )

        # Verify the result
        assert len(result) == 2

        # Verify hooks were updated in database
        with assume_test_silo_mode(SiloMode.REGION):
            updated_hook1 = ServiceHook.objects.get(id=hook1.id)
            updated_hook2 = ServiceHook.objects.get(id=hook2.id)

            assert updated_hook1.url == self.sentry_app.webhook_url
            assert updated_hook2.url == self.sentry_app.webhook_url

            # Events should be expanded
            expected_events = self.sentry_app.events
            assert updated_hook1.events == expected_events
            assert updated_hook2.events == expected_events
            assert updated_hook2.events == ["issue.created"]

    def test_update_webhook_and_events_with_many_installations(self) -> None:
        # Create 1000 webhooks
        with assume_test_silo_mode(SiloMode.REGION):
            hooks_to_create = []
            for _ in range(10000):
                # these hooks arent accurate to actual installation hooks
                # but it's enough to test the performance of the update
                hooks_to_create.append(
                    ServiceHook(
                        application_id=self.sentry_app.application.id,
                        actor_id=self.user.id,
                        installation_id=self.user.id,
                        url=self.sentry_app.webhook_url,
                        events=["comment.created", "error.created"],
                    )
                )
            ServiceHook.objects.bulk_create(hooks_to_create)

            assert (
                ServiceHook.objects.filter(
                    application_id=self.sentry_app.application.id,
                    events=["comment.created", "error.created"],
                ).count()
                == 10000
            )

        result = hook_service.update_webhook_and_events(
            organization_id=self.org.id,
            application_id=self.sentry_app.application.id,
            webhook_url=self.sentry_app.webhook_url,
            events=self.sentry_app.events,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            assert len(result) == 10000
            assert (
                ServiceHook.objects.filter(
                    application_id=self.sentry_app.application.id,
                    events=self.sentry_app.events,
                ).count()
                == 10000
            )
            assert (
                ServiceHook.objects.filter(
                    application_id=self.sentry_app.application.id,
                    events=["comment.created", "error.created"],
                ).count()
                == 0
            )

    def test_update_webhook_and_events_without_webhook_url(self) -> None:
        # Create service hooks
        hook1 = self.create_service_hook(
            application=self.sentry_app.application,
            organization=self.org,
            url="https://example.com",
            events=["issue.created"],
        )
        hook2 = self.create_service_hook(
            application=self.sentry_app.application,
            organization=self.org,
            url="https://example2.com",
            events=["comment.created"],
        )

        # Call update with webhook_url=None (should delete hooks)
        result = hook_service.update_webhook_and_events(
            organization_id=self.org.id,
            application_id=self.sentry_app.application.id,
            webhook_url=None,
            events=["issue"],
        )

        # Should return empty list
        assert result == []

        # Verify hooks were deleted
        with assume_test_silo_mode(SiloMode.REGION):
            assert not ServiceHook.objects.filter(id=hook1.id).exists()
            assert not ServiceHook.objects.filter(id=hook2.id).exists()

    def test_update_webhook_and_events_no_matching_hooks(self) -> None:
        # Create a hook for a different application
        other_app = self.create_sentry_app(name="other-app", organization_id=self.org.id)
        self.create_service_hook(
            application=other_app.application,
            organization=self.org,
            url="https://example.com",
            events=["issue.created"],
        )

        # Try to update hooks for our app (should find no hooks)
        result = hook_service.update_webhook_and_events(
            organization_id=self.org.id,
            application_id=self.sentry_app.application.id,
            webhook_url="https://new-url.com",
            events=["issue"],
        )

        # Should return empty list since no hooks match the application_id
        assert result == []

    def test_create_or_update_webhook_and_events_for_installation_create(self) -> None:
        # Create an installation
        installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.org, user=self.user
        )

        with assume_test_silo_mode(SiloMode.REGION):
            hook = ServiceHook.objects.get(
                installation_id=installation.id, application_id=self.sentry_app.application.id
            )
            hook.delete()

        # Call create_or_update (should create since no hook exists)
        result = hook_service.create_or_update_webhook_and_events_for_installation(
            installation_id=installation.id,
            organization_id=self.org.id,
            webhook_url=self.sentry_app.webhook_url,
            events=self.sentry_app.events,
            application_id=self.sentry_app.application.id,
        )

        # Should return one hook
        assert len(result) == 1

        # Verify hook was created in database
        with assume_test_silo_mode(SiloMode.REGION):
            hook = ServiceHook.objects.get(
                installation_id=installation.id, application_id=self.sentry_app.application.id
            )
            assert hook.url == self.sentry_app.webhook_url
            assert hook.events == self.sentry_app.events

    def test_create_or_update_webhook_and_events_for_installation_update(self) -> None:
        # Create an installation and update events to be mismatched
        installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.org, user=self.user
        )
        with assume_test_silo_mode(SiloMode.REGION):
            hook = ServiceHook.objects.get(
                installation_id=installation.id, application_id=self.sentry_app.application.id
            )
            hook.events = ["error.created"]
            hook.save()

        # Call create_or_update (should update existing hook to match sentry app)
        result = hook_service.create_or_update_webhook_and_events_for_installation(
            installation_id=installation.id,
            organization_id=self.org.id,
            webhook_url=self.sentry_app.webhook_url,
            events=self.sentry_app.events,
            application_id=self.sentry_app.application.id,
        )

        # Should return one hook
        assert len(result) == 1

        # Verify hook was updated (same ID, new values)
        with assume_test_silo_mode(SiloMode.REGION):
            updated_hook = ServiceHook.objects.get(id=hook.id)
            assert updated_hook.url == self.sentry_app.webhook_url
            assert updated_hook.events == self.sentry_app.events

            # Should still be only one hook for this installation
            hooks_count = ServiceHook.objects.filter(
                installation_id=installation.id, application_id=self.sentry_app.application.id
            ).count()
            assert hooks_count == 1

    def test_create_or_update_webhook_and_events_for_installation_delete(self) -> None:
        installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.org, user=self.user
        )
        with assume_test_silo_mode(SiloMode.REGION):
            existing_hook = ServiceHook.objects.get(
                installation_id=installation.id, application_id=self.sentry_app.application.id
            )

        # Call create_or_update with webhook_url=None (should delete)
        result = hook_service.create_or_update_webhook_and_events_for_installation(
            installation_id=installation.id,
            organization_id=self.org.id,
            webhook_url=None,
            events=["issue"],
            application_id=self.sentry_app.application.id,
        )

        # Should return empty list
        assert result == []

        # Verify hook was deleted
        with assume_test_silo_mode(SiloMode.REGION):
            assert not ServiceHook.objects.filter(id=existing_hook.id).exists()

    def test_create_or_update_webhook_and_events_for_installation_delete_nonexistent(self) -> None:
        # Create an installation but no hook
        installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.org, user=self.user
        )
        with assume_test_silo_mode(SiloMode.REGION):
            existing_hook = ServiceHook.objects.get(
                installation_id=installation.id, application_id=self.sentry_app.application.id
            )
            existing_hook.delete()

        # Call create_or_update with webhook_url=None (should handle gracefully)
        result = hook_service.create_or_update_webhook_and_events_for_installation(
            installation_id=installation.id,
            organization_id=self.org.id,
            webhook_url=None,
            events=["issue"],
            application_id=self.sentry_app.application.id,
        )

        # Should return empty list and not raise exception
        assert result == []
