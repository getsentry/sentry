from sentry.api.serializers import Serializer, register
from sentry.incidents.models import AlertRuleTriggerAction


@register(AlertRuleTriggerAction)
class AlertRuleTriggerActionSerializer(Serializer):
    def human_desc(self, action):
        # Returns a human readable description to display in the UI
        if action.type == action.Type.EMAIL.value:
            if action.target:
                if action.target_type == action.TargetType.USER.value:
                    return "Send an email to " + action.target.email
                elif action.target_type == action.TargetType.TEAM.value:
                    return "Send an email to members of #" + action.target.slug
        elif action.type == action.Type.PAGERDUTY.value:
            return "Send a PagerDuty notification to " + action.target_display
        elif action.type == action.Type.SLACK.value:
            return "Send a Slack notification to " + action.target_display
        elif action.type == action.Type.MSTEAMS.value:
            return "Send a Microsoft Teams notification to " + action.target_display
        elif action.type == action.Type.SENTRY_APP.value:
            return "Send a notification via " + action.target_display

    def get_identifier_from_action(self, action):
        if action.type in [
            AlertRuleTriggerAction.Type.PAGERDUTY.value,
            AlertRuleTriggerAction.Type.SENTRY_APP.value,
        ]:
            return int(action.target_identifier)

        return (
            action.target_display if action.target_display is not None else action.target_identifier
        )

    def serialize(self, obj, attrs, user):
        from sentry.incidents.endpoints.serializers import action_target_type_to_string

        return {
            "id": str(obj.id),
            "alertRuleTriggerId": str(obj.alert_rule_trigger_id),
            "type": AlertRuleTriggerAction.get_registered_type(
                AlertRuleTriggerAction.Type(obj.type)
            ).slug,
            "targetType": action_target_type_to_string[
                AlertRuleTriggerAction.TargetType(obj.target_type)
            ],
            "targetIdentifier": self.get_identifier_from_action(obj),
            "integrationId": obj.integration_id,
            "sentryAppId": obj.sentry_app_id,
            "dateCreated": obj.date_added,
            "desc": self.human_desc(obj),
        }
