from unittest.mock import MagicMock, patch

import orjson
from django.core import mail
from django.core.mail.message import EmailMultiAlternatives
from django.db.models import F
from slack_sdk.web import SlackResponse

from sentry.models.activity import Activity
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.organization import Organization
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


@patch(
    "slack_sdk.web.client.WebClient.chat_postMessage",
    return_value=SlackResponse(
        client=None,
        http_verb="POST",
        api_url="https://slack.com/api/chat.postMessage",
        req_args={},
        data={"ok": True},
        headers={},
        status_code=200,
    ),
)
class AssignedNotificationAPITest(APITestCase):
    def validate_email(self, outbox, index, email, txt_msg, html_msg):
        msg = outbox[index]
        assert msg.to == [email]
        assert isinstance(msg, EmailMultiAlternatives)
        # check the txt version
        assert txt_msg in msg.body
        # check the html version
        alt0 = msg.alternatives[0][0]
        assert isinstance(alt0, str)
        assert html_msg in alt0

    def validate_slack_message(self, msg, group, project, user_id, mock_post, index=0):
        blocks = orjson.loads(mock_post.call_args_list[index].kwargs["blocks"])
        fallback_text = mock_post.call_args_list[index].kwargs["text"]
        assert fallback_text == msg

        assert group.title in blocks[1]["text"]["text"]
        assert project.slug in blocks[-2]["elements"][0]["text"]
        channel = mock_post.call_args_list[index].kwargs["channel"]
        assert channel == str(user_id)

    def setup_user(self, user, team):
        member = self.create_member(user=user, organization=self.organization, role="member")
        self.create_team_membership(team, member, role="admin")
        self.create_user_option(user=user, key="self_notifications", value="1")

        self.access_token = "xoxb-access-token"
        self.identity = self.create_identity(
            user=user, identity_provider=self.provider, external_id=user.id
        )

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "domain_name": "sentry.slack.com",
                "installation_type": "born_as_bot",
            },
            name="Awesome Team",
            provider="slack",
        )
        self.provider = self.create_identity_provider(integration=self.integration)

        self.login_as(self.user)

    def test_sends_assignment_notification(self, mock_post: MagicMock) -> None:
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is assigned.
        """
        user = self.create_user()
        self.setup_user(user, self.team)
        self.login_as(user)

        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(url, format="json", data={"assignedTo": user.username})
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)
        # check the txt version
        assert f"assigned {self.group.qualified_short_id} to themselves" in msg.body
        # check the html version
        alt0 = msg.alternatives[0][0]
        assert isinstance(alt0, str)
        assert f"{self.group.qualified_short_id}</a> to themselves</p>" in alt0

        blocks = orjson.loads(mock_post.call_args.kwargs["blocks"])
        fallback_text = mock_post.call_args.kwargs["text"]
        assert fallback_text == f"Issue assigned to {user.get_display_name()} by themselves"
        assert self.group.title in blocks[1]["text"]["text"]
        assert self.project.slug in blocks[-2]["elements"][0]["text"]

    @with_feature("organizations:suspect-commits-in-emails")
    def test_sends_assignment_notification_with_suspect_commits(self, mock_post):
        """
        Test that suspect commits are included in assignment notification emails
        when GroupOwner records exist.
        """
        user = self.create_user()
        self.setup_user(user, self.team)
        self.login_as(user)

        # Create a repository and commit for suspect commit testing
        repo = self.create_repo(
            project=self.project,
            name="example/repo",
        )
        commit = self.create_commit(
            project=self.project,
            repo=repo,
            author=self.create_commit_author(project=self.project, user=user),
            key="abc123def456",
            message="feat: Add new feature\n\nThis is a longer commit message with details.",
        )

        # Create a GroupOwner record for suspect commit
        GroupOwner.objects.create(
            group=self.group,
            user_id=user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )

        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(url, format="json", data={"assignedTo": user.username})
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)

        # Check that suspect commits appear in plain text email
        assert "Suspect Commits" in msg.body
        assert "feat: Add new feature" in msg.body  # commit subject
        assert "abc123d" in msg.body  # shortened commit ID
        assert user.get_display_name() in msg.body  # commit author

        # Check that suspect commits appear in HTML email
        html_content = msg.alternatives[0][0]
        assert isinstance(html_content, str)
        assert "Suspect Commits" in html_content
        assert "feat: Add new feature" in html_content  # commit subject
        assert "abc123d" in html_content  # shortened commit ID
        assert user.get_display_name() in html_content  # commit author

    @with_feature("organizations:suspect-commits-in-emails")
    def test_sends_assignment_notification_without_suspect_commits(self, mock_post):
        """
        Test that assignment notifications work normally when no suspect commits exist.
        """
        user = self.create_user()
        self.setup_user(user, self.team)
        self.login_as(user)

        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(url, format="json", data={"assignedTo": user.username})
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)

        # Check that no suspect commits section appears
        assert "Suspect Commits" not in msg.body
        html_content = msg.alternatives[0][0]
        assert isinstance(html_content, str)
        assert "Suspect Commits" not in html_content

        # But assignment notification should still work
        assert f"assigned {self.group.qualified_short_id} to themselves" in msg.body

    @with_feature("organizations:suspect-commits-in-emails")
    def test_enhanced_privacy_hides_suspect_commits_in_emails(self, mock_post):
        user = self.create_user()
        self.setup_user(user, self.team)
        self.login_as(user)

        repo = self.create_repo(
            project=self.project,
            name="example/repo",
        )
        commit = self.create_commit(
            project=self.project,
            repo=repo,
            author=self.create_commit_author(project=self.project, user=user),
            key="abc123def456",
            message="feat: Add new feature\n\nThis is a longer commit message with details.",
        )
        GroupOwner.objects.create(
            group=self.group,
            user_id=user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )

        # Enable enhanced privacy flag
        self.organization.update(flags=F("flags").bitor(Organization.flags.enhanced_privacy))
        self.organization.refresh_from_db()
        assert self.organization.flags.enhanced_privacy.is_set is True

        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(url, format="json", data={"assignedTo": user.username})
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)

        assert "Suspect Commits" not in msg.body  # plaintext version
        assert "feat: Add new feature" not in msg.body  # commit subject should not appear
        assert "abc123d" not in msg.body  # shortened commit ID should not appear

        html_content = msg.alternatives[0][0]
        assert isinstance(html_content, str)
        assert "Suspect Commits" not in html_content  # HTML version
        assert "feat: Add new feature" not in html_content  # commit subject should not appear
        assert "abc123d" not in html_content  # shortened commit ID should not appear

        # assignment notification should still work normally
        assert f"assigned {self.group.qualified_short_id} to themselves" in msg.body

    @with_feature("organizations:suspect-commits-in-emails")
    def test_enhanced_privacy_default_shows_suspect_commits_in_emails(self, mock_post):
        """
        Test that suspect commits are shown by default in assignment notification emails
        when enhanced privacy is not set.
        """
        user = self.create_user()
        self.setup_user(user, self.team)
        self.login_as(user)

        repo = self.create_repo(
            project=self.project,
            name="example/repo",
        )
        commit = self.create_commit(
            project=self.project,
            repo=repo,
            author=self.create_commit_author(project=self.project, user=user),
            key="abc123def456",
            message="feat: Add new feature\n\nThis is a longer commit message with details.",
        )
        GroupOwner.objects.create(
            group=self.group,
            user_id=user.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit.id},
        )

        assert self.organization.flags.enhanced_privacy.is_set is False

        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(url, format="json", data={"assignedTo": user.username})
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)

        assert "Suspect Commits" in msg.body  # plaintext version
        assert "feat: Add new feature" in msg.body  # commit subject should appear
        assert "abc123d" in msg.body  # shortened commit ID should appear

        html_content = msg.alternatives[0][0]
        assert isinstance(html_content, str)
        assert "Suspect Commits" in html_content  # HTML version
        assert "feat: Add new feature" in html_content  # commit subject should appear
        assert "abc123d" in html_content  # shortened commit ID should appear

        # assignment notification should still work normally
        assert f"assigned {self.group.qualified_short_id} to themselves" in msg.body

    @with_feature("organizations:suspect-commits-in-emails")
    def test_sends_assignment_notification_with_multiple_suspect_commits(self, mock_post):
        """
        Test that when multiple suspect commits exist, the most recent one is displayed in notifications.
        """
        user1 = self.create_user(name="Alice", email="alice@example.com")
        user2 = self.create_user(name="Bob", email="bob@example.com")
        self.setup_user(user1, self.team)
        self.login_as(user1)

        # Create a repository and multiple commits
        repo = self.create_repo(
            project=self.project,
            name="example/repo",
        )
        commit1 = self.create_commit(
            project=self.project,
            repo=repo,
            author=self.create_commit_author(project=self.project, user=user1),
            key="abc123def456",
            message="feat: Add feature A",
        )
        commit2 = self.create_commit(
            project=self.project,
            repo=repo,
            author=self.create_commit_author(project=self.project, user=user2),
            key="def456ghi789",
            message="fix: Bug fix for feature A",
        )

        # Create GroupOwner records for both commits
        GroupOwner.objects.create(
            group=self.group,
            user_id=user1.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit1.id},
        )
        GroupOwner.objects.create(
            group=self.group,
            user_id=user2.id,
            project=self.project,
            organization=self.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            context={"commitId": commit2.id},
        )

        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(url, format="json", data={"assignedTo": user1.username})
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        assert isinstance(msg, EmailMultiAlternatives)

        # Check that only the most recent commit appears (commit2 since it was created later)
        assert "Suspect Commits" in msg.body
        assert "fix: Bug fix for feature A" in msg.body  # This is the more recent commit
        assert "def456g" in msg.body
        assert "Bob" in msg.body

        # The earlier commit should not appear
        assert "feat: Add feature A" not in msg.body

    def test_sends_reassignment_notification_user(self, mock_post: MagicMock) -> None:
        """Test that if a user is assigned to an issue and then the issue is reassigned to a different user
        that the original assignee receives an unassignment notification as well as the new assignee
        receiving an assignment notification"""
        user1 = self.create_user(email="user1@foo.com")
        user2 = self.create_user(email="user2@foo.com")
        self.setup_user(user1, self.team)
        self.setup_user(user2, self.team)
        self.login_as(user1)

        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/"

        # assign to user 1
        with self.tasks():
            response = self.client.put(
                url,
                format="json",
                data={"assignedTo": user1.username, "assignedBy": user1.username},
            )
        assert response.status_code == 200, response.content
        data = {
            "assignee": str(user1.id),
            "assigneeEmail": user1.email,
            "assigneeName": user1.name,
            "assigneeType": "user",
        }
        assert Activity.objects.filter(
            group_id=self.group.id, type=ActivityType.ASSIGNED.value, user_id=user1.id, data=data
        ).exists()

        assert len(mail.outbox) == 1
        txt_msg = f"assigned {self.group.qualified_short_id} to themselves"
        html_msg = f"{self.group.qualified_short_id}</a> to themselves</p>"

        msg = f"Issue assigned to {user1.get_display_name()} by themselves"
        self.validate_slack_message(msg, self.group, self.project, user1.id, mock_post, index=0)
        self.validate_email(mail.outbox, 0, user1.email, txt_msg, html_msg)

        # re-assign to user 2
        with self.tasks():
            response = self.client.put(
                url,
                format="json",
                data={"assignedTo": user2.username, "assignedBy": user1.username},
            )
        assert response.status_code == 200, response.content
        data = {
            "assignee": str(user2.id),
            "assigneeEmail": user2.email,
            "assigneeName": user2.name,
            "assigneeType": "user",
        }
        assert Activity.objects.filter(
            group_id=self.group.id, type=ActivityType.ASSIGNED.value, user_id=user1.id, data=data
        ).exists()

        assert len(mail.outbox) == 3
        txt_msg = f"assigned {self.group.qualified_short_id} to {user2.email}"
        html_msg = f"{self.group.qualified_short_id}</a> to {user2.email}</p>"
        self.validate_email(mail.outbox, 1, user1.email, txt_msg, html_msg)

        txt_msg = f"{user1.email} assigned {self.group.qualified_short_id} to {user2.email}"
        html_msg = f"{self.group.qualified_short_id}</a> to {user2.email}"
        self.validate_email(mail.outbox, 2, user2.email, txt_msg, html_msg)

        msg = f"Issue assigned to {user2.get_display_name()} by {user1.get_display_name()}"
        self.validate_slack_message(msg, self.group, self.project, user1.id, mock_post, index=1)
        self.validate_slack_message(msg, self.group, self.project, user2.id, mock_post, index=2)

    def test_sends_reassignment_notification_team(self, mock_post: MagicMock) -> None:
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

        url = f"/api/0/organizations/{group.organization.slug}/issues/{group.id}/"

        # assign to team1
        with self.tasks():
            response = self.client.put(
                url,
                format="json",
                data={"assignedTo": f"team:{team1.id}", "assignedBy": self.user.username},
            )
        assert response.status_code == 200, response.content
        data = {
            "assignee": str(team1.id),
            "assigneeEmail": None,
            "assigneeName": team1.name,
            "assigneeType": "team",
        }
        assert Activity.objects.filter(
            group_id=group.id, user_id=user1.id, type=ActivityType.ASSIGNED.value, data=data
        ).exists()

        assert len(mail.outbox) == 2
        txt_msg = f"assigned {group.qualified_short_id} to the {team1.slug} team"
        html_msg = f"{group.qualified_short_id}</a> to the {team1.slug} team</p>"
        self.validate_email(mail.outbox, 0, user1.email, txt_msg, html_msg)
        self.validate_email(mail.outbox, 1, user2.email, txt_msg, html_msg)

        msg = f"Issue assigned to the {team1.slug} team by {user1.email}"
        self.validate_slack_message(msg, group, project, user1.id, mock_post, index=0)
        self.validate_slack_message(msg, group, project, user2.id, mock_post, index=1)

        # reassign to team2
        with self.tasks():
            response = self.client.put(
                url,
                format="json",
                data={"assignedTo": f"team:{team2.id}", "assignedBy": self.user.username},
            )
        assert response.status_code == 200, response.content
        data = {
            "assignee": str(team2.id),
            "assigneeEmail": None,
            "assigneeName": team2.name,
            "assigneeType": "team",
        }
        assert Activity.objects.filter(
            group_id=group.id, user_id=user1.id, type=ActivityType.ASSIGNED.value, data=data
        ).exists()

        assert len(mail.outbox) == 6

        txt_msg = f"{user1.email} assigned {group.qualified_short_id} to the {team2.slug} team"
        html_msg = f"{user1.email}</strong> assigned"
        self.validate_email(mail.outbox, 2, user1.email, txt_msg, html_msg)
        self.validate_email(mail.outbox, 3, user2.email, txt_msg, html_msg)

        txt_msg = f"assigned {group.qualified_short_id} to the {team2.slug} team"
        html_msg = f"to the {team2.slug} team</p>"
        self.validate_email(mail.outbox, 4, user3.email, txt_msg, html_msg)
        self.validate_email(mail.outbox, 5, user4.email, txt_msg, html_msg)

        msg = f"Issue assigned to the {team2.slug} team by {user1.email}"
        self.validate_slack_message(msg, group, project, user1.id, mock_post, index=2)
        self.validate_slack_message(msg, group, project, user2.id, mock_post, index=3)
        self.validate_slack_message(msg, group, project, user3.id, mock_post, index=4)
        self.validate_slack_message(msg, group, project, user4.id, mock_post, index=5)
