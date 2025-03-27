import logging
from abc import ABC, abstractmethod

from sentry.grouping.grouptype import ErrorGroupType
from sentry.integrations.opsgenie.utils import OPSGENIE_CUSTOM_PRIORITIES
from sentry.integrations.pagerduty.client import PagerdutySeverity
from sentry.issues.grouptype import MetricIssuePOC
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.utils.registry import NoRegistrationExistsError, Registry
from sentry.workflow_engine.handlers.action.notification.issue_alert import (
    issue_alert_handler_registry,
)
from sentry.workflow_engine.handlers.action.notification.metric_alert import (
    metric_alert_handler_registry,
)
from sentry.workflow_engine.models import Action, DataConditionGroupAction, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData

logger = logging.getLogger(__name__)


class NotificationHandlerException(Exception):
    pass


# TODO(iamrajjoshi): This should be removed once I define the config schemas for each action type
GENERIC_ACTION_CONFIG_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "description": "The configuration schema for Notification Actions",
    "type": "object",
    "properties": {
        "target_identifier": {
            "type": ["string", "null"],
        },
        "target_display": {
            "type": ["string", "null"],
        },
        "target_type": {
            "type": ["integer", "null"],
            "enum": [*ActionTarget] + [None],
        },
    },
}

MESSAGING_ACTION_CONFIG_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "description": "The configuration schema for a Messaging Action",
    "type": "object",
    "properties": {
        "target_identifier": {"type": ["string"]},
        "target_display": {"type": ["string"]},
        "target_type": {
            "type": ["integer"],
            "enum": [ActionTarget.SPECIFIC.value],
        },
    },
    "required": ["target_identifier", "target_display", "target_type"],
    "additionalProperties": False,
}

# Main difference between the discord and slack action config schemas is that
# the target_display is null
DISCORD_ACTION_CONFIG_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "description": "The configuration schema for a Discord Action",
    "type": "object",
    "properties": {
        "target_identifier": {"type": "string"},
        "target_display": {
            "type": ["null"],
        },
        "target_type": {
            "type": ["integer"],
            "enum": [ActionTarget.SPECIFIC.value],
        },
    },
    "required": ["target_identifier", "target_type"],
    "additionalProperties": False,
}

TAGS_SCHEMA = {
    "type": "string",
    "description": "Tags to add to the message",
}

NOTES_SCHEMA = {
    "type": "string",
    "description": "Notes to add to the message",
}

ONCALL_ACTION_CONFIG_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "description": "The configuration schema for a on-call Action",
    "type": "object",
    "properties": {
        "target_identifier": {"type": ["string"]},
        "target_display": {"type": ["string", "null"]},
        "target_type": {
            "type": ["integer"],
            "enum": [ActionTarget.SPECIFIC.value],
        },
    },
    "required": ["target_identifier", "target_type"],
    "additionalProperties": False,
}

PAGERDUTY_ACTION_DATA_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "priority": {
            "type": "string",
            "description": "The priority of the pagerduty action",
            "enum": [severity for severity in PagerdutySeverity],
        },
        "additionalProperties": False,
    },
}

OPSGENIE_ACTION_DATA_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "priority": {
            "type": "string",
            "description": "The priority of the opsgenie action",
            "enum": [*OPSGENIE_CUSTOM_PRIORITIES],
        },
        "additionalProperties": False,
    },
}


class LegacyRegistryInvoker(ABC):
    """
    Abstract base class that defines the interface for notification handlers.
    """

    @staticmethod
    @abstractmethod
    def handle_workflow_action(job: WorkflowEventData, action: Action, detector: Detector) -> None:
        """
        Implement this method to handle the specific notification logic for your handler.
        """
        raise NotImplementedError


group_type_notification_registry = Registry[LegacyRegistryInvoker]()


def execute_via_group_type_registry(
    job: WorkflowEventData, action: Action, detector: Detector
) -> None:
    try:
        handler = group_type_notification_registry.get(detector.type)
        handler.handle_workflow_action(job, action, detector)
    except NoRegistrationExistsError:
        logger.exception(
            "No notification handler found for detector type: %s",
            detector.type,
            extra={"detector_id": detector.id, "action_id": action.id},
        )


def execute_via_issue_alert_handler(
    job: WorkflowEventData, action: Action, detector: Detector
) -> None:
    """
    This exists so that all ticketing actions can use the same handler as issue alerts since that's the only way we can
    ensure that the same thread is used for the notification action.
    """
    IssueAlertRegistryInvoker.handle_workflow_action(job, action, detector)


class IntegrationActionHandler(ActionHandler, ABC):
    # TODO(iamrajjoshi): Switch this to an enum after we decide on what this enum will be
    provider_slug: str


class TicketingActionHandler(IntegrationActionHandler, ABC):
    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Ticketing Action",
        "type": "object",
        "properties": {
            "target_identifier": {
                "type": ["null"],
            },
            "target_display": {
                "type": ["null"],
            },
            "target_type": {
                "type": ["integer"],
                "enum": [ActionTarget.SPECIFIC.value],
            },
        },
    }

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for ticket creation action data blob",
        "properties": {
            "dynamic_form_fields": {
                "type": "array",
                "description": "Dynamic form fields from customer configuration",
                "items": {"type": "object"},
                "default": [],
            },
            "additional_fields": {
                "type": "object",
                "description": "Additional fields that aren't part of standard fields",
                "additionalProperties": True,
                "default": {},
            },
        },
        "additionalProperties": False,
    }

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_issue_alert_handler(job, action, detector)


@action_handler_registry.register(Action.Type.DISCORD)
class DiscordActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = "discord"

    config_schema = DISCORD_ACTION_CONFIG_SCHEMA

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for Discord action data blob",
        "properties": {
            "tags": TAGS_SCHEMA,
        },
        "additionalProperties": False,
    }

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)


@action_handler_registry.register(Action.Type.SLACK)
class SlackActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = "slack"

    config_schema = MESSAGING_ACTION_CONFIG_SCHEMA

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for Slack action data blob",
        "properties": {
            "tags": TAGS_SCHEMA,
            "notes": NOTES_SCHEMA,
        },
        "additionalProperties": False,
    }

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)


@action_handler_registry.register(Action.Type.MSTEAMS)
class MsteamsActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = "msteams"

    config_schema = MESSAGING_ACTION_CONFIG_SCHEMA

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for MSTeams action data blob",
        "properties": {},
        "additionalProperties": False,
    }

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)


@action_handler_registry.register(Action.Type.PAGERDUTY)
class PagerdutyActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = "pagerduty"

    config_schema = ONCALL_ACTION_CONFIG_SCHEMA
    data_schema = PAGERDUTY_ACTION_DATA_SCHEMA


@action_handler_registry.register(Action.Type.OPSGENIE)
class OpsgenieActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = "opsgenie"

    config_schema = ONCALL_ACTION_CONFIG_SCHEMA
    data_schema = OPSGENIE_ACTION_DATA_SCHEMA


@action_handler_registry.register(Action.Type.EMAIL)
class EmailActionHandler(ActionHandler):
    group = ActionHandler.Group.NOTIFICATION

    config_schema = GENERIC_ACTION_CONFIG_SCHEMA
    data_schema = {}

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)


@action_handler_registry.register(Action.Type.SENTRY_APP)
class SentryAppActionHandler(ActionHandler):
    group = ActionHandler.Group.NOTIFICATION

    config_schema = GENERIC_ACTION_CONFIG_SCHEMA
    data_schema = {}

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)


@action_handler_registry.register(Action.Type.PLUGIN)
class PluginActionHandler(ActionHandler):
    group = ActionHandler.Group.NOTIFICATION

    config_schema = GENERIC_ACTION_CONFIG_SCHEMA
    data_schema = {}

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)


@action_handler_registry.register(Action.Type.GITHUB)
class GithubActionHandler(TicketingActionHandler):
    group = ActionHandler.Group.TICKET_CREATION
    provider_slug = "github"


@action_handler_registry.register(Action.Type.GITHUB_ENTERPRISE)
class GithubEnterpriseActionHandler(TicketingActionHandler):
    group = ActionHandler.Group.TICKET_CREATION
    provider_slug = "github_enterprise"


@action_handler_registry.register(Action.Type.JIRA)
class JiraActionHandler(TicketingActionHandler):
    group = ActionHandler.Group.TICKET_CREATION
    provider_slug = "jira"


@action_handler_registry.register(Action.Type.JIRA_SERVER)
class JiraServerActionHandler(TicketingActionHandler):
    group = ActionHandler.Group.TICKET_CREATION
    provider_slug = "jira_server"


@action_handler_registry.register(Action.Type.AZURE_DEVOPS)
class AzureDevopsActionHandler(TicketingActionHandler):
    group = ActionHandler.Group.TICKET_CREATION
    provider_slug = "azure_devops"


@action_handler_registry.register(Action.Type.WEBHOOK)
class WebhookActionHandler(ActionHandler):
    group = ActionHandler.Group.OTHER

    config_schema = GENERIC_ACTION_CONFIG_SCHEMA
    data_schema = {}

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)


@group_type_notification_registry.register(ErrorGroupType.slug)
class IssueAlertRegistryInvoker(LegacyRegistryInvoker):
    @staticmethod
    def handle_workflow_action(job: WorkflowEventData, action: Action, detector: Detector) -> None:
        try:
            handler = issue_alert_handler_registry.get(action.type)
            handler.invoke_legacy_registry(job, action, detector)
        except NoRegistrationExistsError:
            logger.exception(
                "No issue alert handler found for action type: %s",
                action.type,
                extra={"action_id": action.id},
            )
            raise
        except Exception as e:
            logger.exception(
                "Error invoking issue alert handler",
                extra={"action_id": action.id},
            )
            raise NotificationHandlerException(e)


@group_type_notification_registry.register(MetricIssuePOC.slug)
class MetricAlertRegistryInvoker(LegacyRegistryInvoker):
    @staticmethod
    def handle_workflow_action(job: WorkflowEventData, action: Action, detector: Detector) -> None:
        try:
            handler = metric_alert_handler_registry.get(action.type)
            handler.invoke_legacy_registry(job, action, detector)
        except NoRegistrationExistsError:
            logger.exception(
                "No metric alert handler found for action type: %s",
                action.type,
                extra={"action_id": action.id},
            )
            raise
        except Exception as e:
            logger.exception(
                "Error invoking metric alert handler",
                extra={"action_id": action.id},
            )
            raise NotificationHandlerException(e)

    @staticmethod
    def target(action: Action) -> OrganizationMember | Team | str | None:
        target_identifier = action.config.get("target_identifier")
        if target_identifier is None:
            return None

        target_type = action.config.get("target_type")
        if target_type == ActionTarget.USER.value:
            dcga = DataConditionGroupAction.objects.get(action=action)
            return OrganizationMember.objects.get(
                user_id=int(target_identifier),
                organization=dcga.condition_group.organization,
            )
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
