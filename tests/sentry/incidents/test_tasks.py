from __future__ import absolute_import

from datetime import timedelta

import six
from django.core.urlresolvers import reverse
from django.utils import timezone
from exam import patcher
from freezegun import freeze_time

from sentry.incidents.logic import create_incident_activity, subscribe_to_incident
from sentry.incidents.models import (
    IncidentActivityType,
    IncidentStatus,
    IncidentSubscription,
    IncidentSuspectCommit,
)
from sentry.incidents.tasks import (
    build_activity_context,
    calculate_incident_suspects,
    generate_incident_activity_email,
    send_subscriber_notifications,
)
from sentry.models import Commit, Repository
from sentry.testutils import TestCase
from sentry.utils.linksign import generate_signed_link
from sentry.utils.http import absolute_uri


class BaseIncidentActivityTest(object):
    @property
    def incident(self):
        return self.create_incident(title="hello")


class TestSendSubscriberNotifications(BaseIncidentActivityTest, TestCase):
    send_async = patcher("sentry.utils.email.MessageBuilder.send_async")

    def test_simple(self):
        activity = create_incident_activity(
            self.incident, IncidentActivityType.COMMENT, user=self.user, comment="hello"
        )
        send_subscriber_notifications(activity.id)
        # User shouldn't receive an email for their own activity
        self.send_async.assert_not_called()  # NOQA

        self.send_async.reset_mock()
        non_member_user = self.create_user(email="non_member@test.com")
        subscribe_to_incident(activity.incident, non_member_user)

        member_user = self.create_user(email="member@test.com")
        self.create_member([self.team], user=member_user, organization=self.organization)
        subscribe_to_incident(activity.incident, member_user)
        send_subscriber_notifications(activity.id)
        self.send_async.assert_called_once_with([member_user.email])
        assert not IncidentSubscription.objects.filter(
            incident=activity.incident, user=non_member_user
        ).exists()
        assert IncidentSubscription.objects.filter(
            incident=activity.incident, user=member_user
        ).exists()

    def test_invalid_types(self):
        for activity_type in (IncidentActivityType.CREATED, IncidentActivityType.DETECTED):
            activity = create_incident_activity(self.incident, activity_type)
            send_subscriber_notifications(activity.id)
            self.send_async.assert_not_called()  # NOQA
            self.send_async.reset_mock()


class TestGenerateIncidentActivityEmail(BaseIncidentActivityTest, TestCase):
    @freeze_time()
    def test_simple(self):
        activity = create_incident_activity(
            self.incident, IncidentActivityType.COMMENT, user=self.user, comment="hello"
        )
        incident = activity.incident
        recipient = self.create_user()
        message = generate_incident_activity_email(activity, recipient)
        assert message.subject == "Activity on Incident {} (#{})".format(
            incident.title, incident.identifier
        )
        assert message.type == "incident.activity"
        assert message.context == build_activity_context(activity, recipient)


class TestBuildActivityContext(BaseIncidentActivityTest, TestCase):
    def run_test(
        self, activity, expected_username, expected_action, expected_comment, expected_recipient
    ):
        incident = activity.incident
        context = build_activity_context(activity, expected_recipient)
        assert context["user_name"] == expected_username
        assert context["action"] == "%s on incident %s (#%s)" % (
            expected_action,
            activity.incident.title,
            activity.incident.identifier,
        )
        assert (
            context["link"]
            == absolute_uri(
                reverse(
                    "sentry-incident",
                    kwargs={
                        "organization_slug": incident.organization.slug,
                        "incident_id": incident.identifier,
                    },
                )
            )
            + "?referrer=incident_activity_email"
        )
        assert context["comment"] == expected_comment
        assert context["unsubscribe_link"] == generate_signed_link(
            expected_recipient,
            "sentry-account-email-unsubscribe-incident",
            kwargs={"incident_id": incident.id},
        )

    def test_simple(self):
        activity = create_incident_activity(
            self.incident, IncidentActivityType.COMMENT, user=self.user, comment="hello"
        )
        recepient = self.create_user()
        self.run_test(
            activity,
            expected_username=activity.user.name,
            expected_action="left a comment",
            expected_comment=activity.comment,
            expected_recipient=recepient,
        )
        activity.type = IncidentActivityType.STATUS_CHANGE
        activity.value = six.text_type(IncidentStatus.CLOSED.value)
        activity.previous_value = six.text_type(IncidentStatus.OPEN.value)
        self.run_test(
            activity,
            expected_username=activity.user.name,
            expected_action="changed status from %s to %s"
            % (IncidentStatus.OPEN.name.lower(), IncidentStatus.CLOSED.name.lower()),
            expected_comment=activity.comment,
            expected_recipient=recepient,
        )


class CalculateIncidentSuspectsTest(TestCase):
    def test_simple(self):
        release = self.create_release(project=self.project, version="v12")
        event = self.store_event(
            data={
                "timestamp": (timezone.now() - timedelta(minutes=1)).isoformat()[:19],
                "fingerprint": ["group-1"],
                "message": "Kaboom!",
                "platform": "python",
                "stacktrace": {"frames": [{"filename": "sentry/models/release.py"}]},
                "release": release.version,
            },
            project_id=self.project.id,
        )
        group = event.group
        self.repo = Repository.objects.create(
            organization_id=self.organization.id, name=self.organization.id
        )
        release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": self.repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "i fixed a bug",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                }
            ]
        )

        commit = Commit.objects.filter(releasecommit__release__in=[release])
        incident = self.create_incident(self.organization, groups=[group])
        calculate_incident_suspects(incident.id)
        assert IncidentSuspectCommit.objects.filter(incident=incident, commit=commit).exists()
