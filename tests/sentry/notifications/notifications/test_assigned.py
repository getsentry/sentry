import responses
from django.core import mail
from django.core.mail.message import EmailMultiAlternatives

from sentry.models.activity import Activity
from sentry.models.options.user_option import UserOption
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import get_attachment, get_channel, install_slack
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


class AssignedNotificationAPITest(APITestCase):
    def validate_email(self, outbox, index, email, txt_msg, html_msg):
        msg = outbox[index]
        assert msg.to == [email]
        assert isinstance(msg, EmailMultiAlternatives)
        # check the txt version
        assert txt_msg in msg.body
        # check the html version
        assert isinstance(msg.alternatives[0][0], str)
        assert html_msg in msg.alternatives[0][0]

    def validate_slack_message(self, msg, group, project, user_id, index=0):
        attachment, text = get_attachment(index)
        assert text == msg
        assert attachment["title"] == group.title
        assert project.slug in attachment["footer"]
        channel = get_channel(index)
        assert channel == user_id

    def setup_user(self, user, team):
        member = self.create_member(user=user, organization=self.organization, role="member")
        self.create_team_membership(team, member, role="admin")

        UserOption.objects.create(user=user, key="self_notifications", value="1")

        self.access_token = "xoxb-access-token"
        self.identity = self.create_identity(
            user=user, identity_provider=self.provider, external_id=user.id
        )

    def setUp(self):
        super().setUp()

        self.integration = install_slack(self.organization)
        self.provider = self.create_identity_provider(integration=self.integration)

        self.login_as(self.user)

    @responses.activate
    def test_sends_assignment_notification(self):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is assigned.
        """
        user = self.create_user()
        self.setup_user(user, self.team)
        self.login_as(user)

        url = f"/api/0/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(url, format="json", data={"assignedTo": user.username})
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        # check the txt version
        assert f"assigned {self.group.qualified_short_id} to themselves" in msg.body
        # check the html version
        assert isinstance(msg.alternatives[0][0], str)
        assert f"{self.group.qualified_short_id}</a> to themselves</p>" in msg.alternatives[0][0]

        attachment, text = get_attachment()

        assert text == f"Issue assigned to {user.get_display_name()} by themselves"
        assert attachment["title"] == self.group.title
        assert self.project.slug in attachment["footer"]

    @responses.activate
    def test_sends_reassignment_notification_user(self):
        """Test that if a user is assigned to an issue and then the issue is reassigned to a different user
        that the original assignee receives an unassignment notification as well as the new assignee
        receiving an assignment notification"""
        user1 = self.create_user(email="user1@foo.com")
        user2 = self.create_user(email="user2@foo.com")
        self.setup_user(user1, self.team)
        self.setup_user(user2, self.team)
        self.login_as(user1)

        url = f"/api/0/issues/{self.group.id}/"

        # assign to user 1
        with self.tasks():
            response = self.client.put(
                url,
                format="json",
                data={"assignedTo": user1.username, "assignedBy": user1.username},
            )
        assert response.status_code == 200, response.content
        data = {"assignee": str(user1.id), "assigneeEmail": user1.email, "assigneeType": "user"}
        assert Activity.objects.filter(
            group_id=self.group.id, type=ActivityType.ASSIGNED.value, user_id=user1.id, data=data
        ).exists()

        assert len(mail.outbox) == 1
        txt_msg = f"assigned {self.group.qualified_short_id} to themselves"
        html_msg = f"{self.group.qualified_short_id}</a> to themselves</p>"

        msg = f"Issue assigned to {user1.get_display_name()} by themselves"
        self.validate_slack_message(msg, self.group, self.project, user1.id, index=0)
        self.validate_email(mail.outbox, 0, user1.email, txt_msg, html_msg)

        # re-assign to user 2
        with self.tasks():
            response = self.client.put(
                url,
                format="json",
                data={"assignedTo": user2.username, "assignedBy": user1.username},
            )
        assert response.status_code == 200, response.content
        data = {"assignee": str(user2.id), "assigneeEmail": user2.email, "assigneeType": "user"}
        assert Activity.objects.filter(
            group_id=self.group.id, type=ActivityType.ASSIGNED.value, user_id=user1.id, data=data
        ).exists()

        assert len(mail.outbox) == 3
        txt_msg = f"{user1.email} assigned {self.group.qualified_short_id} to {user2.email}"
        html_msg = f"{self.group.qualified_short_id}</a> to {user2.email}"
        self.validate_email(mail.outbox, 1, user2.email, txt_msg, html_msg)

        txt_msg = f"assigned {self.group.qualified_short_id} to {user2.email}"
        html_msg = f"{self.group.qualified_short_id}</a> to {user2.email}</p>"
        self.validate_email(mail.outbox, 2, user1.email, txt_msg, html_msg)

        msg = f"Issue assigned to {user2.get_display_name()} by {user1.get_display_name()}"
        self.validate_slack_message(msg, self.group, self.project, user2.id, index=1)
        self.validate_slack_message(msg, self.group, self.project, user1.id, index=2)

    @responses.activate
    def test_sends_reassignment_notification_team(self):
        """Test that if a team is assigned to an issue and then the issue is reassigned to a different team
        that the originally assigned team receives an unassignment notification as well as the new assigned
        team receiving an assignment notification"""
        user1 = self.create_user("foo@example.com")
        user2 = self.create_user("bar@example.com")
        user3 = self.create_user("baz@example.com")
        user4 = self.create_user("boo@example.com")
        team1 = self.create_team()
        team2 = self.create_team()
        project = self.create_project(teams=[team1, team2])
        group = self.create_group(project=project)
        self.setup_user(user1, team1)
        self.setup_user(user2, team1)
        self.setup_user(user3, team2)
        self.setup_user(user4, team2)

        self.login_as(user1)

        url = f"/api/0/issues/{group.id}/"

        # assign to team1
        with self.tasks():
            response = self.client.put(
                url,
                format="json",
                data={"assignedTo": f"team:{team1.id}", "assignedBy": self.user.username},
            )
        assert response.status_code == 200, response.content
        data = {"assignee": str(team1.id), "assigneeEmail": None, "assigneeType": "team"}
        assert Activity.objects.filter(
            group_id=group.id, user_id=user1.id, type=ActivityType.ASSIGNED.value, data=data
        ).exists()

        assert len(mail.outbox) == 2
        txt_msg = f"assigned {group.qualified_short_id} to the {team1.slug} team"
        html_msg = f"{group.qualified_short_id}</a> to the {team1.slug} team</p>"
        self.validate_email(mail.outbox, 0, user2.email, txt_msg, html_msg)
        self.validate_email(mail.outbox, 1, user1.email, txt_msg, html_msg)
        msg = f"Issue assigned to the {team1.slug} team by {user1.email}"
        self.validate_slack_message(msg, group, project, user2.id, index=0)
        self.validate_slack_message(msg, group, project, user1.id, index=1)

        # reassign to team2
        with self.tasks():
            response = self.client.put(
                url,
                format="json",
                data={"assignedTo": f"team:{team2.id}", "assignedBy": self.user.username},
            )
        assert response.status_code == 200, response.content
        data = {"assignee": str(team2.id), "assigneeEmail": None, "assigneeType": "team"}
        assert Activity.objects.filter(
            group_id=group.id, user_id=user1.id, type=ActivityType.ASSIGNED.value, data=data
        ).exists()

        assert len(mail.outbox) == 6

        txt_msg = f"{user1.email} assigned {group.qualified_short_id} to the {team2.slug} team"
        html_msg = f"{user1.email}</strong> assigned"
        self.validate_email(mail.outbox, 2, user2.email, txt_msg, html_msg)
        self.validate_email(mail.outbox, 3, user3.email, txt_msg, html_msg)

        txt_msg = f"assigned {group.qualified_short_id} to the {team2.slug} team"
        html_msg = f"to the {team2.slug} team</p>"
        self.validate_email(mail.outbox, 4, user4.email, txt_msg, html_msg)
        self.validate_email(mail.outbox, 5, user1.email, txt_msg, html_msg)

        msg = f"Issue assigned to the {team2.slug} team by {user1.email}"
        self.validate_slack_message(msg, group, project, user2.id, index=2)
        self.validate_slack_message(msg, group, project, user3.id, index=3)
        self.validate_slack_message(msg, group, project, user4.id, index=4)
        self.validate_slack_message(msg, group, project, user1.id, index=5)
