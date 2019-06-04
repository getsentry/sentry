from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.auth.access import from_user
from sentry.incidents.models import (
    IncidentActivity,
    IncidentActivityType,
    IncidentStatus,
)
from sentry.tasks.base import instrumented_task
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.linksign import generate_signed_link


@instrumented_task(
    name='sentry.incidents.tasks.send_subscriber_notifications',
    queue='incidents.notify',
)
def send_subscriber_notifications(activity_id):
    from sentry.incidents.logic import (
        get_incident_subscribers,
        unsubscribe_from_incident,
    )
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

    # Only send notifications for specific activity types.
    if activity.type not in (
        IncidentActivityType.COMMENT.value,
        IncidentActivityType.STATUS_CHANGE.value,
    ):
        return

    # Check that the user still has access to at least one of the projects
    # related to the incident. If not then unsubscribe them.
    projects = list(activity.incident.projects.all())
    for subscriber in get_incident_subscribers(activity.incident).select_related('user'):
        user = subscriber.user
        access = from_user(user, activity.incident.organization)
        if not any(project for project in projects if access.has_project_access(project)):
            unsubscribe_from_incident(activity.incident, user)
        elif user != activity.user:
            msg = generate_incident_activity_email(activity, user)
            msg.send_async([user.email])


def generate_incident_activity_email(activity, user):
    incident = activity.incident
    return MessageBuilder(
        subject=u'Activity on Incident {} (#{})'.format(incident.title, incident.identifier),
        template=u'sentry/emails/incidents/activity.txt',
        html_template=u'sentry/emails/incidents/activity.html',
        type='incident.activity',
        context=build_activity_context(activity, user),
    )


def build_activity_context(activity, user):
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
        'unsubscribe_link': generate_signed_link(
            user,
            'sentry-account-email-unsubscribe-incident',
            kwargs={'incident_id': incident.id},
        ),
    }
