import logging
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Final, get_type_hints

import sentry_sdk

from sentry.models.organization import Organization
from sentry.notifications.platform.metrics import (
    NotificationEventLifecycleMetric,
    NotificationInteractionType,
)
from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.rollout import NotificationRolloutService
from sentry.notifications.platform.target import NotificationTargetDto
from sentry.notifications.platform.templates.types import NotificationTemplateSource
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationStrategy,
    NotificationTarget,
    NotificationTemplate,
)
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import notifications_tasks
from sentry.utils.registry import NoRegistrationExistsError

logger = logging.getLogger(__name__)


class NotificationServiceError(Exception):
    pass


class NotificationService[T: NotificationData]:
    def __init__(self, *, data: T):
        self.data: Final[T] = data

    @staticmethod
    def has_access(
        organization: Organization | RpcOrganization, source: NotificationTemplateSource
    ) -> bool:
        return NotificationRolloutService(organization=organization).should_notify(source=source)

    def notify_target(self, *, target: NotificationTarget) -> None:
        """
        Send a notification directly to a target synchronously.
        NOTE: This method ignores notification settings. When possible, consider using a strategy instead of
              using this method directly to prevent unwanted noise associated with your notifications.
        NOTE: Use this method when you care about the notification sending result and delivering that back to the user.
              Otherwise, we generally reccomend using the async version.
        """
        if not self.data:
            raise NotificationServiceError(
                "Notification service must be initialized with data before sending!"
            )

        event_lifecycle = NotificationEventLifecycleMetric(
            interaction_type=NotificationInteractionType.NOTIFY_TARGET_SYNC,
            notification_source=self.data.source,
            notification_provider=target.provider_key,
        )

        with event_lifecycle.capture() as lifecycle:
            # Step 1: Get the provider, and validate the target against it
            provider = provider_registry.get(target.provider_key)
            provider.validate_target(target=target)

            # Step 2: Render the template
            template_cls = template_registry.get(self.data.source)
            template = template_cls()

            # Update the lifecycle with the notification category now that we know it
            event_lifecycle.notification_category = template.category
            renderable = NotificationService.render_template(
                data=self.data, template=template, provider=provider
            )

            # Step 3: Send the notification
            try:
                provider.send(target=target, renderable=renderable)
            except IntegrationConfigurationError as e:
                lifecycle.record_halt(halt_reason=e, create_issue=False)
                raise
            except Exception as e:
                lifecycle.record_failure(failure_reason=e, create_issue=True)
                raise

            return None

    @classmethod
    def render_template[RenderableT](
        cls,
        data: T,
        template: NotificationTemplate[T],
        provider: type[NotificationProvider[RenderableT]],
    ) -> RenderableT:
        rendered_template = template.render(data=data)
        renderer = provider.get_renderer(data=data, category=template.category)
        return renderer.render(data=data, rendered_template=rendered_template)

    def notify_async(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
    ) -> None:
        """
        Send a notification directly to a target via task, if you care about using the result of the notification, use notify_sync instead.
        """
        self._validate_strategy_and_targets(strategy=strategy, targets=targets)
        targets = self._get_targets(strategy=strategy, targets=targets)

        for target in targets:
            serialized_target = NotificationTargetDto(target=target)
            serialized_data = NotificationDataDto(notification_data=self.data).to_dict()
            notify_target_async.delay(
                data=serialized_data,
                nested_target=serialized_target.to_dict(),
            )

    def notify_sync(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
    ) -> Mapping[NotificationProviderKey, list[str]]:
        self._validate_strategy_and_targets(strategy=strategy, targets=targets)
        targets = self._get_targets(strategy=strategy, targets=targets)

        errors = defaultdict(list)
        for target in targets:
            try:
                self.notify_target(target=target)
            except IntegrationConfigurationError as e:
                errors[target.provider_key].append(str(e))
            except Exception as e:
                sentry_sdk.capture_exception(e)

        return errors

    def _validate_strategy_and_targets(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
    ) -> None:
        if not strategy and not targets:
            raise NotificationServiceError(
                "Must provide either a strategy or targets. Strategy is preferred."
            )
        if strategy and targets:
            raise NotificationServiceError(
                "Cannot provide both strategy and targets, only one is permitted. Strategy is preferred."
            )

    def _get_targets(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
    ) -> list[NotificationTarget]:
        if strategy:
            targets = strategy.get_targets()
        if not targets:
            logger.warning("Strategy '%s' did not yield targets", strategy.__class__.__name__)
            return []
        return targets


@instrumented_task(
    name="src.sentry.notifications.platform.service.notify_target_async",
    namespace=notifications_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def notify_target_async(
    *,
    data: dict[str, Any],
    nested_target: dict[str, Any],
) -> None:
    """
    Send a notification directly to a target asynchronously.
    NOTE: This method ignores notification settings. When possible, consider using a strategy instead of
            using this method directly to prevent unwanted noise associated with your notifications.
    """
    try:
        notification_data_dto = NotificationDataDto.from_dict(data)
    except (NotificationServiceError, NoRegistrationExistsError) as e:
        logger.warning(
            "notifications.platform.notify_target_async.deserialize_error",
            extra={"error": e, "data": data, "nested_target": nested_target},
        )
        return

    notification_data = notification_data_dto.notification_data

    lifecycle_metric = NotificationEventLifecycleMetric(
        interaction_type=NotificationInteractionType.NOTIFY_TARGET_ASYNC,
        notification_source=notification_data.source,
    )

    with lifecycle_metric.capture() as lifecycle:
        # Step 1: Deserialize the target from nested structure
        serialized_target = NotificationTargetDto.from_dict(nested_target)
        target = serialized_target.target
        lifecycle_metric.notification_provider = target.provider_key
        lifecycle.add_extras({"source": notification_data.source, "target": target.to_dict()})

        # Step 2: Get the provider, and validate the target against it
        provider = provider_registry.get(target.provider_key)
        provider.validate_target(target=target)

        # Step 3: Render the template
        template_cls = template_registry.get(notification_data.source)
        template = template_cls()
        lifecycle_metric.notification_category = template.category
        renderable = NotificationService.render_template(
            data=notification_data, template=template, provider=provider
        )

        # Step 4: Send the notification
        try:
            provider.send(target=target, renderable=renderable)
        except IntegrationConfigurationError as e:
            lifecycle.record_halt(halt_reason=e, create_issue=False)
        except Exception as e:
            lifecycle.record_failure(failure_reason=e, create_issue=True)


@dataclass
class NotificationDataDto:
    """
    A wrapper class that handles serialization/deserialization of NotificationData.
    """

    notification_data: NotificationData

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.notification_data.source,
            "data": self.notification_data.__dict__,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "NotificationDataDto":
        source = data.get("source")
        if source is None:
            raise NotificationServiceError("Source is required")

        notification_data_cls = template_registry.get(source).get_data_class()
        notification_fields = data.get("data", {}).copy()

        # We're using type hints to know which fields need special conversion
        type_hints = get_type_hints(notification_data_cls)

        for field_name, value in notification_fields.items():
            if field_name in type_hints:
                expected_type = type_hints[field_name]
                if expected_type == datetime and isinstance(value, str):
                    notification_fields[field_name] = datetime.fromisoformat(value)

        notification_data = notification_data_cls(**notification_fields)
        return cls(notification_data=notification_data)
