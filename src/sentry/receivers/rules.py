from sentry import features
from sentry.models.rule import Rule
from sentry.notifications.types import FallthroughChoiceType
from sentry.signals import project_created

DEFAULT_RULE_LABEL = "Send a notification for new issues"
DEFAULT_RULE_ACTIONS = [
    {
        "id": "sentry.mail.actions.NotifyEmailAction",
        "targetType": "IssueOwners",
        "targetIdentifier": None,
        "fallthroughType": FallthroughChoiceType.ACTIVE_MEMBERS.value,
    }
]
DEFAULT_RULE_DATA = {
    "match": "all",
    "conditions": [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}],
    "actions": DEFAULT_RULE_ACTIONS,
}

DEFAULT_RULE_LABEL_NEW = "Send a notification for high priority issues"
DEFAULT_RULE_ACTIONS_NEW = [
    {
        "id": "sentry.mail.actions.NotifyEmailAction",
        "targetType": "IssueOwners",
        "targetIdentifier": None,
        "fallthroughType": FallthroughChoiceType.ACTIVE_MEMBERS.value,
    }
]
DEFAULT_RULE_DATA_NEW = {
    "match": "all",
    "conditions": [
        {"id": "sentry.rules.conditions.high_priority_issue.HighPriorityIssueCondition"}
    ],
    "actions": DEFAULT_RULE_ACTIONS_NEW,
}


def create_default_rules(project, default_rules=True, RuleModel=Rule, **kwargs):
    if not default_rules:
        return

    if features.has("organizations:default-high-priority-alerts", project.organization):
        rule_data = DEFAULT_RULE_DATA_NEW
        RuleModel.objects.create(project=project, label=DEFAULT_RULE_LABEL_NEW, data=rule_data)

    else:
        rule_data = DEFAULT_RULE_DATA
        RuleModel.objects.create(project=project, label=DEFAULT_RULE_LABEL, data=rule_data)


project_created.connect(create_default_rules, dispatch_uid="create_default_rules", weak=False)
