from __future__ import annotations

import logging
from typing import override

from sentry.investigations.triggers import InvestigationTriggerReferrer, trigger_investigation
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.models import Action, Workflow
from sentry.workflow_engine.processors.action import is_action_permitted
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, ActionInvocation

logger = logging.getLogger(__name__)


@action_handler_registry.register(Action.Type.SEER_INVESTIGATION)
class SeerInvestigationActionHandler(ActionHandler):
    group = ActionHandler.Group.SEER

    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for Seer Investigation Actions",
        "type": "object",
        "properties": {
            "target_identifier": {"type": ["string", "null"]},
            "target_display": {"type": ["null"]},
            "target_type": {"type": ["integer", "null"], "enum": [None]},
        },
    }
    data_schema = {}

    @staticmethod
    @override
    def execute(invocation: ActionInvocation) -> None:
        group = invocation.event_data.group
        organization = group.project.organization
        logging_ctx = {
            "organization_id": organization.id,
            "action_id": invocation.action.id,
            "workflow_id": invocation.workflow_id,
            "group_id": group.id,
        }

        # Re-checked at execution time so the flag also acts as a kill switch for
        # actions that were created while it was on.
        if not is_action_permitted(Action.Type.SEER_INVESTIGATION, organization):
            logger.info("investigations.alert_action.feature_disabled", extra=logging_ctx)
            return

        # Investigations run with a user's access, and an alert has no requesting
        # user, so we act as whoever created the alert.
        user_id = (
            Workflow.objects.filter(id=invocation.workflow_id)
            .values_list("created_by_id", flat=True)
            .first()
        )
        if user_id is None:
            logger.info("investigations.alert_action.no_workflow_creator", extra=logging_ctx)
            return

        # Match the access rules of the interactive investigation endpoints, and
        # don't act on behalf of a creator who has since left the organization.
        if not organization.flags.allow_joinleave:
            logger.info("investigations.alert_action.closed_membership", extra=logging_ctx)
            return
        if not OrganizationMember.objects.filter(
            organization_id=organization.id,
            user_id=user_id,
            user_is_active=True,
            invite_status=InviteStatus.APPROVED.value,
        ).exists():
            logger.info("investigations.alert_action.creator_not_member", extra=logging_ctx)
            return

        event = invocation.event_data.event
        trigger_investigation(
            group=group,
            user_id=user_id,
            referrer=InvestigationTriggerReferrer.ALERT_ACTION,
            event_id=event.event_id if isinstance(event, GroupEvent) else None,
        )
