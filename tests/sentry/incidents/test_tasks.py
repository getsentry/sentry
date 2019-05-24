from __future__ import absolute_import

from exam import patcher


import six
from django.core.urlresolvers import reverse

from sentry.incidents.logic import (
    create_incident_activity,
    subscribe_to_incident,
)
from sentry.incidents.models import (
    IncidentActivityType,
    IncidentStatus,
)
from sentry.incidents.tasks import (
    build_activity_context,
    generate_incident_activity_email,
    send_subscriber_notifications,
)
from sentry.testutils import TestCase
from sentry.utils.http import absolute_uri


class BaseIncidentActivityTest(object):
    @property
    def incident(self):
        return self.create_incident(title='hello')


class TestSendSubscriberNotifications(BaseIncidentActivityTest, TestCase):
    send_async = patcher('sentry.utils.email.MessageBuilder.send_async')

    def test_simple(self):
        activity = create_incident_activity(
            self.incident,
            IncidentActivityType.COMMENT,
            user=self.user,
            comment='hello',
        )
        send_subscriber_notifications(activity.id)
        subscribe_to_incident(activity.incident, self.user)
        # User shouldn't receive an email for their own activity
        self.send_async.assert_called_once_with([])
        self.send_async.reset_mock()
        user = self.create_user(email='test@test.com')
        subscribe_to_incident(activity.incident, user)
        send_subscriber_notifications(activity.id)
        self.send_async.assert_called_once_with([user.email])


class TestGenerateIncidentActivityEmail(BaseIncidentActivityTest, TestCase):
    def test_simple(self):
        activity = create_incident_activity(
            self.incident,
            IncidentActivityType.COMMENT,
            user=self.user,
            comment='hello',
        )
        incident = activity.incident
        message = generate_incident_activity_email(activity)
        assert message.subject == 'Activity on Incident {} (#{})'.format(
            incident.title,
            incident.identifier,
        )
        assert message.type == 'incident.activity'
        assert message.context == build_activity_context(activity)


class TestBuildActivityContext(BaseIncidentActivityTest, TestCase):
    def run_test(
        self,
        activity,
        expected_username,
        expected_action,
        expected_comment,
    ):
        incident = activity.incident
        context = build_activity_context(activity)
        assert context['user_name'] == expected_username
        assert context['action'] == '%s on incident %s (#%s)' % (
            expected_action,
            activity.incident.title,
            activity.incident.identifier,
        )
        assert context['link'] == absolute_uri(reverse(
            'sentry-incident',
            kwargs={
                'organization_slug': incident.organization.slug,
                'incident_id': incident.identifier,
            },
        ))
        assert context['comment'] == expected_comment
        assert context['unsubscribe_link'] == ''

    def test_simple(self):
        activity = create_incident_activity(
            self.incident,
            IncidentActivityType.COMMENT,
            user=self.user,
            comment='hello',
        )
        self.run_test(
            activity,
            expected_username=activity.user.name,
            expected_action='left a comment',
            expected_comment=activity.comment,
        )
        activity.type = IncidentActivityType.STATUS_CHANGE
        activity.value = six.text_type(IncidentStatus.CLOSED.value)
        activity.previous_value = six.text_type(IncidentStatus.CREATED.value)
        self.run_test(
            activity,
            expected_username=activity.user.name,
            expected_action='changed status from %s to %s' % (
                IncidentStatus.CREATED.name.lower(),
                IncidentStatus.CLOSED.name.lower(),
            ),
            expected_comment=activity.comment,
        )
