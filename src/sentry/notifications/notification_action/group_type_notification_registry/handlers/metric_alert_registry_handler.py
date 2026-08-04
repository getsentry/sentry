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
            # Fall through silently: execute_via_group_type_registry catches this
            # and routes to the issue alert handler for action types (e.g. WEBHOOK,
            # PLUGIN, ticketing) that have no metric-alert-specific handler.
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
        team_id_by_action_id: dict[int, int] = {}

        for action in actions:
            target_identifier = action.config.get("target_identifier")
            if target_identifier is None:
                result[action.id] = None
                continue

            target_type = action.config.get("target_type")
            if target_type == ActionTarget.USER.value:
                user_actions.append(action)
            elif target_type == ActionTarget.TEAM.value:
                team_id_by_action_id[action.id] = int(target_identifier)
            elif target_type == ActionTarget.SPECIFIC.value:
                result[action.id] = target_identifier
            else:
                result[action.id] = None

        org_by_action_id: dict[int, int] = {}
        organization_scoped_action_ids = [action.id for action in user_actions]
        organization_scoped_action_ids.extend(team_id_by_action_id)
        if organization_scoped_action_ids:
            dcgas = DataConditionGroupAction.objects.filter(
                action__in=organization_scoped_action_ids
            ).select_related("condition_group")
            org_by_action_id = {
                dcga.action_id: dcga.condition_group.organization_id for dcga in dcgas
            }

        if user_actions:
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

        if team_id_by_action_id:
            teams = {
                (team.id, team.organization_id): team
                for team in Team.objects.filter(
                    id__in=team_id_by_action_id.values(),
                    organization_id__in=set(org_by_action_id.values()),
                )
            }
            for action_id, team_id in team_id_by_action_id.items():
                organization_id = org_by_action_id.get(action_id)
                result[action_id] = teams.get((team_id, organization_id))

        return result
