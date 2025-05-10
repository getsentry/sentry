from collections.abc import Mapping
from typing import Any

from rest_framework import serializers

from sentry import features
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.exceptions import NotRegistered
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.manager import default_manager as integrations_manager
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler

ActionData = dict[str, Any]
ActionConfig = dict[str, Any]


# Comprehensive mapping from Action Type to Integration Key;
# If this action isn't associated with an integration, the value is None.
_ACTION_TYPE_TO_INTEGRATION_KEY: Mapping[Action.Type, str | None] = {
    Action.Type.GITHUB: "github",
    Action.Type.GITHUB_ENTERPRISE: "github_enterprise",
    Action.Type.JIRA: "jira",
    Action.Type.JIRA_SERVER: "jira_server",
    Action.Type.AZURE_DEVOPS: "azure_devops",
    Action.Type.OPSGENIE: "opsgenie",
    Action.Type.PAGERDUTY: "pagerduty",
    Action.Type.DISCORD: "discord",
    Action.Type.MSTEAMS: "msteams",
    Action.Type.SLACK: "slack",
    Action.Type.SENTRY_APP: None,
    Action.Type.WEBHOOK: None,
    Action.Type.PLUGIN: None,
    Action.Type.EMAIL: None,
}

assert len(_ACTION_TYPE_TO_INTEGRATION_KEY) == len(Action.Type)


def get_integration_features(action_type: Action.Type) -> frozenset[IntegrationFeatures]:
    integration_key = _ACTION_TYPE_TO_INTEGRATION_KEY[action_type]
    if not integration_key:
        return frozenset()
    try:
        integration = integrations_manager.get(integration_key)
    except NotRegistered:
        raise ValueError(f"No integration found for action type: {action_type}")
    return integration.features


_ACTION_RELEVANT_INTEGRATION_FEATURES = {
    IntegrationFeatures.ISSUE_BASIC,
    IntegrationFeatures.ISSUE_SYNC,
    IntegrationFeatures.TICKET_RULES,
    IntegrationFeatures.ALERT_RULE,
    IntegrationFeatures.ENTERPRISE_ALERT_RULE,
    IntegrationFeatures.ENTERPRISE_INCIDENT_MANAGEMENT,
    IntegrationFeatures.INCIDENT_MANAGEMENT,
}


def _is_action_permitted(action_type: Action.Type, organization: Organization) -> bool:
    integration_features = get_integration_features(action_type)
    required_org_features = integration_features.intersection(_ACTION_RELEVANT_INTEGRATION_FEATURES)
    feature_names = [
        f"organizations:integrations-{integration_feature}"
        for integration_feature in required_org_features
    ]
    return all(features.has(feature_name, organization) for feature_name in feature_names)


class BaseActionValidator(CamelSnakeSerializer):
    data: Any = serializers.JSONField()
    config: Any = serializers.JSONField()
    type = serializers.ChoiceField(choices=[(t.value, t.name) for t in Action.Type])
    integration_id = serializers.IntegerField(required=False)

    def _get_action_handler(self) -> ActionHandler:
        action_type = self.initial_data.get("type")
        return action_handler_registry.get(action_type)

    def validate_data(self, value) -> ActionData:
        data_schema = self._get_action_handler().data_schema
        return validate_json_schema(value, data_schema)

    def validate_config(self, value) -> ActionConfig:
        config_schema = self._get_action_handler().config_schema
        return validate_json_schema(value, config_schema)

    def validate_type(self, value) -> Any:
        try:
            action_type = Action.Type(value)
        except ValueError:
            raise serializers.ValidationError(f"Invalid action type: {value}")
        self._check_action_type(action_type)
        return value

    def _check_action_type(self, action_type: Action.Type) -> None:
        organization = self.context.get("organization")
        if not organization:
            # ¯\_(ツ)_/¯
            # TODO(kylec): Require organization to be in the context.
            return
        if not _is_action_permitted(action_type, organization):
            raise serializers.ValidationError(
                f"Organization does not allow this action type: {action_type}"
            )

    def create(self, validated_value: dict[str, Any]) -> Action:
        """ """
        self._check_action_type(validated_value["type"])
        return Action.objects.create(**validated_value)

    def update(self, instance: Action, validated_value: dict[str, Any]) -> Action:
        if instance.type != validated_value["type"]:
            self._check_action_type(validated_value["type"])
        instance.update(**validated_value)
        return instance
