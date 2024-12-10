from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import FallthroughChoiceType
from sentry.signals import project_created

DEFAULT_RULE_LABEL = "Send a notification for high priority issues"
DEFAULT_RULE_ACTIONS = [
    {
        "id": "sentry.mail.actions.NotifyEmailAction",
        "targetType": "IssueOwners",
        "targetIdentifier": None,
        "fallthroughType": FallthroughChoiceType.ACTIVE_MEMBERS.value,
    }
]
DEFAULT_RULE_DATA = {
    "action_match": "any",
    "conditions": [
        {"id": "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition"},
        {"id": "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition"},
    ],
    "actions": DEFAULT_RULE_ACTIONS,
}


# TODO(snigdha): Remove this constant when seer-based-priority is GA
PLATFORMS_WITH_PRIORITY_ALERTS = ["python", "javascript"]


def create_default_rules(project: Project, default_rules=True, RuleModel=Rule, **kwargs):
    if not default_rules:
        return

    rule_data = DEFAULT_RULE_DATA
    RuleModel.objects.create(project=project, label=DEFAULT_RULE_LABEL, data=rule_data)


project_created.connect(create_default_rules, dispatch_uid="create_default_rules", weak=False)
