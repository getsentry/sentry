from __future__ import absolute_import, print_function

from django.db.models.signals import post_save

from sentry.models import Project, Rule

DEFAULT_RULE_LABEL = 'Send a notification for new issues'
DEFAULT_RULE_DATA = {
    'match': 'all',
    'conditions': [
        {
            'id': 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition'
        },
    ],
    'actions': [
        {
            'id': 'sentry.rules.actions.notify_event.NotifyEventAction'
        },
    ],
}


def create_default_rules(instance, created=True, RuleModel=Rule, **kwargs):
    if not created:
        return

    RuleModel.objects.create(
        project=instance,
        label=DEFAULT_RULE_LABEL,
        data=DEFAULT_RULE_DATA,
    )


post_save.connect(
    create_default_rules,
    sender=Project,
    dispatch_uid="create_default_rules",
    weak=False,
)
