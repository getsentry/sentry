from sentry import features
from sentry.models.project import Project
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


PLATFORMS_WITH_NEW_DEFAULT = ["python", "javascript"]


def has_high_priority_issue_alerts(project: Project) -> bool:
    # High priority alerts are enabled if the project has the feature flag
    # or for python/javascript projects in organization that have the feature flag
    return features.has("projects:high-priority-alerts", project) or (
        features.has("organizations:default-high-priority-alerts", project.organization)
        and project.platform is not None
        and any(
            project.platform.startswith(base_platform)
            for base_platform in PLATFORMS_WITH_NEW_DEFAULT
        )
    )


def create_default_rules(project, default_rules=True, RuleModel=Rule, **kwargs):
    if not default_rules:
        return

    if has_high_priority_issue_alerts(project):
        rule_data = DEFAULT_RULE_DATA_NEW
        RuleModel.objects.create(project=project, label=DEFAULT_RULE_LABEL_NEW, data=rule_data)

    else:
        rule_data = DEFAULT_RULE_DATA
        RuleModel.objects.create(project=project, label=DEFAULT_RULE_LABEL, data=rule_data)


project_created.connect(create_default_rules, dispatch_uid="create_default_rules", weak=False)
