import logging
from collections import defaultdict
from collections.abc import Mapping
from typing import Any, Final

from pydantic import ValidationError

from sentry.models.organization import Organization
from sentry.notifications.models.notificationthread import NotificationThread
from sentry.notifications.platform.metrics import (
    NotificationEventLifecycleMetric,
    NotificationInteractionType,
)
from sentry.notifications.platform.provider import (
    NotificationProvider,
    SendFailure,
    SendFailureStatus,
    SendResult,
)
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.rollout import NotificationRolloutService
from sentry.notifications.platform.target import deserialize_target, serialize_target
from sentry.notifications.platform.threading import (
    ThreadContext,
    ThreadingConfig,
    ThreadingLookup,
    ThreadingOptions,
    ThreadingService,
)
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationSource,
    NotificationStrategy,
    NotificationTarget,
    NotificationTemplate,
)
from sentry.organizations.services.organization.model import RpcOrganization
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
        organization: Organization | RpcOrganization, source: NotificationSource
    ) -> bool:
        return NotificationRolloutService(organization=organization).should_notify(source=source)

    def notify_target(
        self,
        *,
        target: NotificationTarget,
        threading_options: ThreadingOptions | None = None,
    ) -> SendResult:
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

            # Step 3: Resolve thread if threading requested
            thread_context: ThreadContext | None = None
            if threading_options is not None:
                thread_context = NotificationService._resolve_thread_context(
                    target=target, threading_options=threading_options
                )

            # Step 4: Send the notification
            result = provider.send(
                target=target, renderable=renderable, thread_context=thread_context
            )

            if isinstance(result, SendFailure):
                match result.status:
                    case SendFailureStatus.HALT:
                        lifecycle.record_halt(halt_reason=result.exception, create_issue=False)
                    case SendFailureStatus.FAILURE:
                        lifecycle.record_failure(failure_reason=result.exception, create_issue=True)

            # Step 5: Store threading result
            if threading_options is not None:
                try:
                    NotificationService._handle_threading_result(
                        threading_options=threading_options,
                        thread=thread_context.thread if thread_context else None,
                        target=target,
                        result=result,
                    )
                except Exception as e:
                    # We don't want to retry the task if we fail to store the threading result
                    # as that would cause double send issues
                    lifecycle.record_failure(failure_reason=e, create_issue=False)

            return result

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

    @staticmethod
    def _resolve_thread_context(
        *,
        target: NotificationTarget,
        threading_options: ThreadingOptions,
    ) -> ThreadContext:
        threading_lookup = ThreadingLookup(
            key_type=threading_options.thread_key.key_type,
            key_data=threading_options.thread_key.key_data,
            provider_key=target.provider_key,
            target_id=target.resource_id,
        )
        thread = ThreadingService.resolve(threading_lookup=threading_lookup)
        return ThreadContext(
            thread_key=threading_options.thread_key,
            thread=thread,
            reply_broadcast=threading_options.reply_broadcast,
        )

    def notify_async(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
        threading_options: ThreadingOptions | None = None,
        **kwargs: Any,
    ) -> None:
        """
        Send a notification directly to a target via task, if you care about using the result of the notification, use notify_sync instead.
        """
        self._validate_strategy_and_targets(strategy=strategy, targets=targets)
        targets = self._get_targets(strategy=strategy, targets=targets)

        for target in targets:
            serialized_data = serialize_notification_data(self.data)
            serialized_target = serialize_target(target)
            notify_target_async.delay(
                data=serialized_data,
                nested_target=serialized_target,
                threading_options=threading_options.dict() if threading_options else None,
            )

    def notify_sync(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
        threading_options: ThreadingOptions | None = None,
    ) -> Mapping[NotificationProviderKey, list[SendFailure]]:
        self._validate_strategy_and_targets(strategy=strategy, targets=targets)
        targets = self._get_targets(strategy=strategy, targets=targets)

        errors: dict[NotificationProviderKey, list[SendFailure]] = defaultdict(list)
        for target in targets:
            result = self.notify_target(target=target, threading_options=threading_options)
            if isinstance(result, SendFailure):
                errors[target.provider_key].append(result)

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

    @staticmethod
    def _handle_threading_result(
        *,
        threading_options: ThreadingOptions,
        thread: NotificationThread | None,
        target: NotificationTarget,
        result: SendResult | SendFailure,
    ) -> None:
        if isinstance(result, SendResult) and result.provider_message_id is not None:
            if thread is None:
                threading_config = ThreadingConfig(
                    key_type=threading_options.thread_key.key_type,
                    key_data=threading_options.thread_key.key_data,
                    provider_key=target.provider_key,
                    target_id=target.resource_id,
                    thread_identifier=result.provider_message_id,
                    provider_data=None,
                )
                ThreadingService.store_new_thread(
                    threading_config=threading_config,
                    external_message_id=result.provider_message_id,
                )
            else:
                ThreadingService.store_existing_thread(
                    thread=thread,
                    external_message_id=result.provider_message_id,
                )

        # If the first send failed, then we don't create a record since it'll be orphaned
        elif isinstance(result, SendFailure) and thread is not None:
            ThreadingService.store_error(
                thread=thread,
                provider_key=target.provider_key,
                target_id=target.resource_id,
                error_details=result.error_details or {},
            )

        # If we hit this point, it either means the result is malformed
        # or the provider was requested to use threading but didn't (e.g Discord, Email, MSTeams)
        return None


@instrumented_task(
    name="src.sentry.notifications.platform.service.notify_target_async",
    namespace=notifications_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CELL,
)
def notify_target_async(
    *,
    data: dict[str, Any],
    nested_target: dict[str, Any],
    threading_options: dict[str, Any] | None = None,
) -> None:
    """
    Send a notification directly to a target asynchronously.
    NOTE: This method ignores notification settings. When possible, consider using a strategy instead of
            using this method directly to prevent unwanted noise associated with your notifications.
    """
    try:
        notification_data = deserialize_notification_data(data)
    except (NotificationServiceError, NoRegistrationExistsError, ValidationError) as e:
        logger.warning(
            "notifications.platform.notify_target_async.deserialize_error",
            extra={"error": e, "data": data, "nested_target": nested_target},
        )
        return

    options = ThreadingOptions.parse_obj(threading_options) if threading_options else None

    lifecycle_metric = NotificationEventLifecycleMetric(
        interaction_type=NotificationInteractionType.NOTIFY_TARGET_ASYNC,
        notification_source=notification_data.source,
    )

    with lifecycle_metric.capture() as lifecycle:
        # Step 1: Deserialize the target from nested structure
        target = deserialize_target(nested_target)
        lifecycle_metric.notification_provider = target.provider_key
        lifecycle.add_extras({"source": notification_data.source, "target": target.dict()})

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

        # Step 4: Resolve thread if threading requested
        thread_context: ThreadContext | None = None
        if options is not None:
            thread_context = NotificationService._resolve_thread_context(
                target=target, threading_options=options
            )

        # Step 5: Send the notification
        result = provider.send(target=target, renderable=renderable, thread_context=thread_context)

        if isinstance(result, SendFailure):
            match result.status:
                case SendFailureStatus.HALT:
                    lifecycle.record_halt(halt_reason=result.exception, create_issue=False)
                case SendFailureStatus.FAILURE:
                    lifecycle.record_failure(failure_reason=result.exception, create_issue=True)

        # Step 6: Store threading result
        if options is not None:
            try:
                NotificationService._handle_threading_result(
                    threading_options=options,
                    thread=thread_context.thread if thread_context else None,
                    target=target,
                    result=result,
                )
            except Exception as e:
                # We don't want to retry the task if we fail to store the threading result
                # as that would cause double send issues
                lifecycle.record_failure(failure_reason=e, create_issue=False)


def serialize_notification_data(data: NotificationData) -> dict[str, Any]:
    return {"source": data.source, "data": data.dict()}


def deserialize_notification_data(raw: dict[str, Any]) -> NotificationData:
    source = raw.get("source")
    if source is None:
        raise NotificationServiceError("Source is required")

    notification_data_cls = template_registry.get(source).get_data_class()
    return notification_data_cls.parse_obj(raw.get("data", {}))
