import logging

from sentry import features
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import FallthroughChoiceType
from sentry.signals import alert_rule_created, project_created
from sentry.users.services.user.model import RpcUser

logger = logging.getLogger("sentry")

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
    rule = RuleModel.objects.create(project=project, label=DEFAULT_RULE_LABEL, data=rule_data)

    try:
        user: RpcUser = project.organization.get_default_owner()
    except IndexError:
        logger.warning(
            "Cannot record default rule created for organization (%s) due to missing owners",
            project.organization_id,
        )
        return

    if features.has("organizations:quick-start-updates", project.organization, actor=user):
        # When a user creates a new project and opts to set up an issue alert within it,
        # the corresponding task in the quick start sidebar is automatically marked as complete.
        alert_rule_created.send(
            user=user,
            project=project,
            rule_id=rule.id,
            # The default rule created within a new project is always of type 'issue'
            rule_type="issue",
            sender=type(project),
            is_api_token=False,
        )


project_created.connect(create_default_rules, dispatch_uid="create_default_rules", weak=False)
