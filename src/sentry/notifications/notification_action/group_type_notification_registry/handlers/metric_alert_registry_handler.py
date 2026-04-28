import logging
from collections.abc import Sequence
from typing import override

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
    @override
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
        return MetricAlertRegistryHandler.get_targets([action]).get(action.id)

    @staticmethod
    def get_targets(
        actions: Sequence[Action],
    ) -> dict[int, OrganizationMember | Team | str | None]:
        """
        Batch-load targets for multiple actions to avoid N+1 queries.
        Returns a dict mapping action.id to its resolved target.
        """
        result: dict[int, OrganizationMember | Team | str | None] = {}

        user_actions: list[Action] = []
        team_ids: list[int] = []
        team_action_ids: dict[int, list[int]] = {}

        for action in actions:
            target_identifier = action.config.get("target_identifier")
            if target_identifier is None:
                result[action.id] = None
                continue

            target_type = action.config.get("target_type")
            if target_type == ActionTarget.USER.value:
                user_actions.append(action)
            elif target_type == ActionTarget.TEAM.value:
                tid = int(target_identifier)
                team_ids.append(tid)
                team_action_ids.setdefault(tid, []).append(action.id)
            elif target_type == ActionTarget.SPECIFIC.value:
                result[action.id] = target_identifier
            else:
                result[action.id] = None

        if user_actions:
            dcgas = DataConditionGroupAction.objects.filter(
                action__in=[a.id for a in user_actions]
            ).select_related("condition_group")
            org_by_action_id = {
                dcga.action_id: dcga.condition_group.organization_id for dcga in dcgas
            }

            org_members = OrganizationMember.objects.filter(
                user_id__in=[int(a.config["target_identifier"]) for a in user_actions],
                organization_id__in=set(org_by_action_id.values()),
            )
            member_by_key = {(om.user_id, om.organization_id): om for om in org_members}

            for action in user_actions:
                org_id = org_by_action_id.get(action.id)
                if org_id is not None:
                    key = (int(action.config["target_identifier"]), org_id)
                    result[action.id] = member_by_key.get(key)
                else:
                    result[action.id] = None

        if team_ids:
            teams = {t.id: t for t in Team.objects.filter(id__in=team_ids)}
            for tid, action_ids in team_action_ids.items():
                for action_id in action_ids:
                    result[action_id] = teams.get(tid)

        return result
