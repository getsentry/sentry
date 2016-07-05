from __future__ import absolute_import, print_function

from django.db.models.signals import post_save

from sentry.models import Project, Rule


def create_default_rules(instance, created=True, RuleModel=Rule, **kwargs):
    if not created:
        return

    RuleModel.objects.create(
        project=instance,
        label='Send a notification for new events',
        data={
            'match': 'all',
            'conditions': [
                {'id': 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition'},
            ],
            'actions': [
                {'id': 'sentry.rules.actions.notify_event.NotifyEventAction'},
            ],
        },
    )


post_save.connect(
    create_default_rules,
    sender=Project,
    dispatch_uid="create_default_rules",
    weak=False,
)
