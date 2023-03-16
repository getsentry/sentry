import datetime

from sentry.models import Activity, ExternalIssue, Group, GroupLink, GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.tasks.merge import merge_groups
from sentry.testutils import APITestCase
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test
from sentry.types.activity import ActivityType


@region_silo_test(stable=True)
class GroupNoteTest(APITestCase):
    def test_simple(self):
        group = self.group

        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "hello world"},
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(activity.id)

    def test_note_merge(self):
        """Test that when 2 (or more) issues with comments are merged, the chronological order of the comments are preserved."""
        now = datetime.datetime.now()

        project1 = self.create_project()
        event1 = self.store_event(data={}, project_id=project1.id)
        group1 = event1.group
        note1 = Activity.objects.create(
            group=group1,
            project=project1,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "This looks bad :)"},
            datetime=now - datetime.timedelta(days=70),
        )
        note2 = Activity.objects.create(
            group=group1,
            project=project1,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "Yeah we should probably look into this"},
            datetime=now - datetime.timedelta(days=66),
        )

        project2 = self.create_project()
        group2 = self.create_group(project2)

        note3 = Activity.objects.create(
            group=group2,
            project=project2,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "I have been a good Sentry :)"},
            datetime=now - datetime.timedelta(days=90),
        )
        note4 = Activity.objects.create(
            group=group2,
            project=project2,
            type=ActivityType.NOTE.value,
            user_id=self.user.id,
            data={"text": "You have been a bad user :)"},
            datetime=now - datetime.timedelta(days=88),
        )

        with self.tasks():
            merge_groups([group1.id], group2.id)

        assert not Group.objects.filter(id=group1.id).exists()

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group2.id}/comments/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 4

        assert response.data[0]["id"] == str(note2.id)
        assert response.data[0]["data"]["text"] == note2.data["text"]
        assert response.data[1]["id"] == str(note1.id)
        assert response.data[1]["data"]["text"] == note1.data["text"]
        assert response.data[2]["id"] == str(note4.id)
        assert response.data[2]["data"]["text"] == note4.data["text"]
        assert response.data[3]["id"] == str(note3.id)
        assert response.data[3]["data"]["text"] == note3.data["text"]


@region_silo_test(stable=True)
class GroupNoteCreateTest(APITestCase):
    def test_simple(self):
        group = self.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        response = self.client.post(url, format="json")
        assert response.status_code == 400

        response = self.client.post(url, format="json", data={"text": "hello world"})
        assert response.status_code == 201, response.content

        activity = Activity.objects.get(id=response.data["id"])
        assert activity.user_id == self.user.id
        assert activity.group == group
        assert activity.data == {"text": "hello world"}

        response = self.client.post(url, format="json", data={"text": "hello world"})
        assert response.status_code == 400, response.content

    def test_with_mentions(self):
        user = self.create_user(email="hello@meow.com")

        self.org = self.create_organization(name="Gnarly Org", owner=None)
        self.team = self.create_team(organization=self.org, name="Ultra Rad Team")

        # member that IS NOT part of the team
        self.create_member(user=user, organization=self.org, role="member", teams=[])
        # member that IS part of the team
        self.create_member(user=self.user, organization=self.org, role="member", teams=[self.team])
        group = self.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        # mentioning a member that does not exist returns 400
        response = self.client.post(
            url,
            format="json",
            data={"text": "**meredith@getsentry.com** is fun", "mentions": ["8"]},
        )
        assert response.status_code == 400, response.content

        user_id = str(self.user.id)

        # mentioning a member in the correct team returns 201
        response = self.client.post(
            url,
            format="json",
            data={"text": "**meredith@getsentry.com** is so fun", "mentions": ["%s" % user_id]},
        )
        assert response.status_code == 201, response.content

        user_id = str(user.id)

        # mentioning a member that exists but NOT in the team returns
        # validation error
        response = self.client.post(
            url,
            format="json",
            data={"text": "**hello@meow.com** is not so fun", "mentions": ["%s" % user_id]},
        )

        assert response.data == {"mentions": ["Cannot mention a non team member"]}

    def test_with_team_mentions(self):
        user = self.create_user(email="redTeamUser@example.com")

        self.org = self.create_organization(name="Gnarly Org", owner=None)
        # team that IS part of the project
        self.team = self.create_team(organization=self.org, name="Red Team", members=[user])
        # team that IS NOT part of the project
        self.team2 = self.create_team(organization=self.org, name="Blue Team")

        self.create_member(user=self.user, organization=self.org, role="member", teams=[self.team])

        group = self.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        # mentioning a team that does not exist returns 400
        response = self.client.post(
            url,
            format="json",
            data={
                "text": "hey **blue-team** fix this bug",
                "mentions": ["team:%s" % self.team2.id],
            },
        )
        assert response.status_code == 400, response.content

        assert response.data == {
            "mentions": ["Mentioned team not found or not associated with project"]
        }

        # mentioning a team in the project returns 201
        response = self.client.post(
            url,
            format="json",
            data={"text": "hey **red-team** fix this bug", "mentions": ["team:%s" % self.team.id]},
        )
        assert response.status_code == 201, response.content
        assert (
            len(
                GroupSubscription.objects.filter(
                    group=group, reason=GroupSubscriptionReason.team_mentioned
                )
            )
            == 1
        )

    def test_with_group_link(self):
        group = self.group

        integration = self.create_integration(
            organization=group.organization,
            provider="example",
            external_id="123456",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        self.user.name = "Sentry Admin"
        with exempt_from_silo_limits():
            self.user.save()
        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        with self.feature({"organizations:integrations-issue-sync": True}):
            with self.tasks():
                comment = "hello world"
                response = self.client.post(url, format="json", data={"text": comment})
                assert response.status_code == 201, response.content

                activity = Activity.objects.get(id=response.data["id"])
                assert activity.user_id == self.user.id
                assert activity.group == group
                assert activity.data == {"text": comment, "external_id": "123456789"}
