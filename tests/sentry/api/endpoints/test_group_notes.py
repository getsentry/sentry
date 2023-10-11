import datetime

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.notifications.types import GroupSubscriptionReason
from sentry.silo import SiloMode
from sentry.tasks.merge import merge_groups
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


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
        assert event1.group is not None
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
        user_not_on_team = self.create_user(email="hello@meow.com")
        user_on_team = self.create_user(email="hello@woof.com")

        self.org = self.create_organization(name="Gnarly Org", owner=None)
        self.team = self.create_team(organization=self.org, name="Ultra Rad Team")
        self.create_member(user=self.user, organization=self.org, role="member", teams=[self.team])

        # member that IS NOT part of the team
        self.create_member(user=user_not_on_team, organization=self.org, role="member", teams=[])
        # member that IS part of the team
        self.create_member(
            user=user_on_team, organization=self.org, role="member", teams=[self.team]
        )
        group = self.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        # mentioning a member that does not exist returns 400
        response = self.client.post(
            url,
            format="json",
            data={"text": "**meredith@getsentry.com** is fun", "mentions": ["8888"]},
        )
        assert response.status_code == 400, response.content

        # mentioning a member in the correct team returns 201
        response = self.client.post(
            url,
            format="json",
            data={"text": "**hello@woof.com** is so fun", "mentions": [f"{user_on_team.id}"]},
        )
        assert response.status_code == 201, response.content
        assert GroupSubscription.objects.get(
            user_id=self.user.id,
            group=group,
            project=group.project,
            reason=GroupSubscriptionReason.comment,
        )
        assert GroupSubscription.objects.get(
            user_id=user_on_team.id,
            group=group,
            project=group.project,
            reason=GroupSubscriptionReason.mentioned,
        )

        # mentioning a member that exists but NOT in the team returns
        # validation error
        response = self.client.post(
            url,
            format="json",
            data={
                "text": "**hello@meow.com** is not so fun",
                "mentions": [f"{user_not_on_team.id}"],
            },
        )

        assert response.data == {"mentions": ["Cannot mention a non team member"]}

    @with_feature("organizations:participants-purge")
    @with_feature("organizations:team-workflow-notifications")
    def test_mentions_with_participants_purge_flag(self):
        self.org = self.create_organization(name="Gnarly Org", owner=None)
        self.team = self.create_team(organization=self.org, name="Ultra Rad Team")
        user_on_team = self.create_user(email="hello@woof.com")
        self.create_member(user=self.user, organization=self.org, role="member", teams=[self.team])
        # member that IS part of the team
        self.create_member(
            user=user_on_team, organization=self.org, role="member", teams=[self.team]
        )
        group = self.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        # mentioning a member does NOT subscribe them to the issue
        response = self.client.post(
            url,
            format="json",
            data={"text": "**hello@woof.com** is so fun", "mentions": [f"{user_on_team.id}"]},
        )
        assert response.status_code == 201, response.content
        assert GroupSubscription.objects.get(
            user_id=self.user.id,
            group=group,
            project=group.project,
            reason=GroupSubscriptionReason.comment,
        )
        assert not GroupSubscription.objects.filter(
            user_id=user_on_team.id,
            group=group,
            project=group.project,
            reason=GroupSubscriptionReason.mentioned,
        ).exists()

        # mentioning a team does NOT subscribe the team to the issue
        response = self.client.post(
            url,
            format="json",
            data={"text": "**ultra-rad-team** is so rad", "mentions": [f"team:{self.team.id}"]},
        )
        assert response.status_code == 201, response.content
        assert GroupSubscription.objects.get(
            user_id=self.user.id,
            group=group,
            project=group.project,
            reason=GroupSubscriptionReason.comment,
        )
        assert not GroupSubscription.objects.filter(
            team=self.team.id,
            group=group,
            project=group.project,
            reason=GroupSubscriptionReason.mentioned,
        ).exists()

    def test_with_team_user_mentions(self):
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
        with assume_test_silo_mode(SiloMode.CONTROL):
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

    @with_feature("organizations:team-workflow-notifications")
    def test_with_team_mentions(self):
        """
        This test assures teams can be subscribed via mention, rather than subscribing the individual users on the team.
        """
        user = self.create_user(email="grunt@teamgalactic.com")

        self.org = self.create_organization(name="Galactic Org", owner=None)
        self.team = self.create_team(organization=self.org, name="Team Galactic", members=[user])
        self.create_member(user=self.user, organization=self.org, role="member", teams=[self.team])

        group = self.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        # mentioning a team in the project returns 201
        response = self.client.post(
            url,
            format="json",
            data={
                "text": "hey **team-galactic** check out this bug",
                "mentions": ["team:%s" % self.team.id],
            },
        )
        assert response.status_code == 201, response.content

        # should subscribe the team and not the user with the team_mentioned reason
        assert GroupSubscription.objects.filter(
            group=group, team=self.team, reason=GroupSubscriptionReason.team_mentioned
        ).exists()
        assert not GroupSubscription.objects.filter(group=group, user_id=user.id)

    @with_feature("organizations:team-workflow-notifications")
    def test_with_user_on_team_mentions(self):
        """
        This test assures that if a user is mentioned along with their team, they get subscribed both individually and as part of the team.
        """
        user = self.create_user(email="maxie@teammagma.com")

        self.org = self.create_organization(name="Emerald Org", owner=None)
        self.team = self.create_team(organization=self.org, name="Team Magma", members=[user])
        self.create_member(user=self.user, organization=self.org, role="member", teams=[self.team])

        group = self.group

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/comments/"

        # mentioning a team and a user in the project returns 201
        response = self.client.post(
            url,
            format="json",
            data={
                "text": "look at this **team-magma** **maxie@teammagma.com**",
                "mentions": ["team:%s" % self.team.id, "%s" % user.id],
            },
        )
        assert response.status_code == 201, response.content

        # should subscribe the team and the user
        assert GroupSubscription.objects.filter(
            group=group, team=self.team, reason=GroupSubscriptionReason.team_mentioned
        ).exists()
        assert GroupSubscription.objects.filter(
            group=group, user_id=user.id, reason=GroupSubscriptionReason.mentioned
        )
