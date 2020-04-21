from __future__ import absolute_import

from django.db import transaction

from sentry.models.projectoption import ProjectOption
from sentry.models.rule import Rule, RuleStatus
from sentry.models.user import User
from sentry.models.useroption import UserOption

mail_action = {
    "id": "sentry.mail.actions.NotifyEmailAction",
    "targetType": "IssueOwners",
    "targetIdentifier": "None",
}


def set_user_option(UserOption, user, key, value, project):
    inst, created = UserOption.objects.get_or_create(
        user=user, project=project, key=key, defaults={"value": value}
    )
    if not created and inst.value != value:
        inst.update(value=value)


def migrate_project_to_issue_alert_targeting(project):
    if project.flags.has_issue_alerts_targeting:
        # Migration has already been run.
        return
    with transaction.atomic():
        # Determine whether this project actually has mail enabled
        try:
            mail_enabled = ProjectOption.objects.get(project=project, key="mail:enabled").value
        except ProjectOption.DoesNotExist:
            mail_enabled = True
        for rule in Rule.objects.filter(project=project, status=RuleStatus.ACTIVE):
            migrate_legacy_rule(rule, mail_enabled)

        if not mail_enabled:
            # If mail disabled, then we want to disable mail options for all
            # users associated with this project so that they don't suddenly start
            # getting mail via the `MailAdapter`, since it will always be enabled.
            for user in User.objects.filter(
                sentry_orgmember_set__teams__in=project.teams.all(), is_active=True
            ):
                set_user_option(UserOption, user, "mail:alert", 0, project)
                set_user_option(UserOption, user, "workflow:notifications", "2", project=project)

        # This marks the migration finished and shows the new UI
        project.flags.has_issue_alerts_targeting = True
        project.save()


def migrate_legacy_rule(rule, mail_enabled):
    actions = rule.data.get("actions", [])
    new_actions = []
    has_mail_action = False
    for action in actions:
        action_id = action.get("id")
        if action_id == "sentry.rules.actions.notify_event.NotifyEventAction":
            # This is the "Send a notification (for all legacy integrations)" action.
            # When this action exists, we want to add the new `NotifyEmailAction` action
            # to the rule. We'll still leave `NotifyEventAction` in place, since it will
            # only notify non-mail plugins once we've migrated.
            new_actions.append(action)
            has_mail_action = True
        elif (
            action_id == "sentry.rules.actions.notify_event_service.NotifyEventServiceAction"
            and action.get("service") == "mail"
        ):
            # This is the "Send a notification via mail" action. When this action
            # exists, we want to add the new `NotifyEmailAction` action to the rule.
            # We'll drop this action from the rule, since all it does it send mail and
            # we don't want to double up.
            has_mail_action = True
        else:
            new_actions.append(action)

    # We only add the new action if the mail plugin is actually enabled, and there's an
    # action that sends by mail. We do this outside the loop to ensure we don't add it
    # more than once.
    if mail_enabled and has_mail_action:
        new_actions.append(mail_action)

    if actions != new_actions:
        rule.data["actions"] = new_actions
        rule.save()
