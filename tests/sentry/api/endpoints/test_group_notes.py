from __future__ import absolute_import

import six

from sentry.models import (
    Activity,
    GroupLink,
    GroupSubscription,
    GroupSubscriptionReason,
    ExternalIssue,
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import APITestCase


class GroupNoteTest(APITestCase):
    def test_simple(self):
        group = self.group

        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=Activity.NOTE,
            user=self.user,
            data={"text": "hello world"},
        )

        self.login_as(user=self.user)

        url = u"/api/0/issues/{}/comments/".format(group.id)
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(activity.id)


class GroupNoteCreateTest(APITestCase):
    def test_simple(self):
        group = self.group

        self.login_as(user=self.user)

        url = u"/api/0/issues/{}/comments/".format(group.id)

        response = self.client.post(url, format="json")
        assert response.status_code == 400

        response = self.client.post(url, format="json", data={"text": "hello world"})
        assert response.status_code == 201, response.content

        activity = Activity.objects.get(id=response.data["id"])
        assert activity.user == self.user
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

        url = u"/api/0/issues/{}/comments/".format(group.id)

        # mentioning a member that does not exist returns 400
        response = self.client.post(
            url,
            format="json",
            data={"text": "**meredith@getsentry.com** is fun", "mentions": [u"8"]},
        )
        assert response.status_code == 400, response.content

        user_id = six.text_type(self.user.id)

        # mentioning a member in the correct team returns 201
        response = self.client.post(
            url,
            format="json",
            data={"text": "**meredith@getsentry.com** is so fun", "mentions": [u"%s" % user_id]},
        )
        assert response.status_code == 201, response.content

        user_id = six.text_type(user.id)

        # mentioning a member that exists but NOT in the team returns
        # validation error
        response = self.client.post(
            url,
            format="json",
            data={"text": "**hello@meow.com** is not so fun", "mentions": [u"%s" % user_id]},
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

        url = u"/api/0/issues/{}/comments/".format(group.id)

        # mentioning a team that does not exist returns 400
        response = self.client.post(
            url,
            format="json",
            data={
                "text": "hey **blue-team** fix this bug",
                "mentions": [u"team:%s" % self.team2.id],
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
            data={"text": "hey **red-team** fix this bug", "mentions": [u"team:%s" % self.team.id]},
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

        integration = Integration.objects.create(provider="example", external_id="123456")
        integration.add_organization(group.organization, self.user)

        OrganizationIntegration.objects.filter(
            integration_id=integration.id, organization_id=group.organization.id
        ).update(
            config={
                "sync_comments": True,
                "sync_status_outbound": True,
                "sync_status_inbound": True,
                "sync_assignee_outbound": True,
                "sync_assignee_inbound": True,
            }
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
        self.user.save()
        self.login_as(user=self.user)

        url = u"/api/0/issues/{}/comments/".format(group.id)

        with self.feature({"organizations:integrations-issue-sync": True}):
            with self.tasks():
                comment = "hello world"
                response = self.client.post(url, format="json", data={"text": comment})
                assert response.status_code == 201, response.content

                activity = Activity.objects.get(id=response.data["id"])
                assert activity.user == self.user
                assert activity.group == group
                assert activity.data == {"text": comment, "external_id": "123456789"}
