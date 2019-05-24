from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.incidents.models import (
    IncidentActivity,
    IncidentActivityType,
    IncidentStatus,
)
from sentry.tasks.base import instrumented_task
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri


@instrumented_task(name='sentry.incidents.tasks.send_subscriber_notifications')
def send_subscriber_notifications(activity_id):
    from sentry.incidents.logic import get_incident_subscribers
    try:
        activity = IncidentActivity.objects.select_related(
            'incident',
            'user',
            'incident__organization',
        ).get(
            id=activity_id,
        )
    except IncidentActivity.DoesNotExist:
        return

    subscribers = get_incident_subscribers(activity.incident).select_related('user')
    msg = generate_incident_activity_email(activity)
    msg.send_async([sub.user.email for sub in subscribers if sub.user != activity.user])


def generate_incident_activity_email(activity):
    incident = activity.incident
    return MessageBuilder(
        subject=u'Activity on Incident {} (#{})'.format(incident.title, incident.identifier),
        template=u'sentry/emails/incidents/activity.txt',
        html_template=u'sentry/emails/incidents/activity.html',
        type='incident.activity',
        context=build_activity_context(activity),
    )


def build_activity_context(activity):
    if activity.type == IncidentActivityType.COMMENT.value:
        action = 'left a comment'
    else:
        action = 'changed status from %s to %s' % (
            IncidentStatus(int(activity.previous_value)).name.lower(),
            IncidentStatus(int(activity.value)).name.lower(),
        )
    incident = activity.incident

    action = '%s on incident %s (#%s)' % (action, incident.title, incident.identifier)

    return {
        'user_name': activity.user.name if activity.user else 'Sentry',
        'action': action,
        'link': absolute_uri(reverse(
            'sentry-incident',
            kwargs={
                'organization_slug': incident.organization.slug,
                'incident_id': incident.identifier,
            },
        )),
        'comment': activity.comment,
        # TODO: Build unsubscribe page and link to it
        'unsubscribe_link': '',
    }
