import logging

from sentry.incidents.grouptype import MetricIssue
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.registry import (
    group_type_notification_registry,
    metric_alert_handler_registry,
)
from sentry.notifications.notification_action.types import LegacyRegistryHandler
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action, DataConditionGroupAction
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


@group_type_notification_registry.register(MetricIssue.slug)
class MetricAlertRegistryHandler(LegacyRegistryHandler):
    @staticmethod
    def handle_workflow_action(invocation: ActionInvocation) -> None:
        try:
            handler = metric_alert_handler_registry.get(invocation.action.type)
            handler.invoke_legacy_registry(invocation)
        except NoRegistrationExistsError:
            logger.exception(
                "No metric alert handler found for action type: %s",
                invocation.action.type,
                extra={"action_id": invocation.action.id},
            )
            raise
        except Exception:
            logger.exception(
                "Error invoking metric alert handler",
                extra={"action_id": invocation.action.id},
            )
            raise

    @staticmethod
    def target(action: Action) -> OrganizationMember | Team | str | None:
        target_identifier = action.config.get("target_identifier")
        if target_identifier is None:
            return None

        target_type = action.config.get("target_type")
        if target_type == ActionTarget.USER.value:
            dcga = DataConditionGroupAction.objects.get(action=action)
            try:
                return OrganizationMember.objects.get(
                    user_id=int(target_identifier),
                    organization=dcga.condition_group.organization,
                )
            except OrganizationMember.DoesNotExist:
                # user is no longer a member of the organization
                pass
        elif target_type == ActionTarget.TEAM.value:
            try:
                return Team.objects.get(id=int(target_identifier))
            except Team.DoesNotExist:
                pass
        elif target_type == ActionTarget.SPECIFIC.value:
            # TODO: This is only for email. We should have a way of validating that it's
            # ok to contact this email.
            return target_identifier
        return None
