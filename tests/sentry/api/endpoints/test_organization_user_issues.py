from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import EventUser, OrganizationMemberTeam
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class OrganizationUserIssuesTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationUserIssuesTest, self).setUp()
        self.org = self.create_organization()
        self.org.flags.allow_joinleave = False
        self.org.save()
        self.team1 = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)
        self.project1 = self.create_project(teams=[self.team1])
        self.project2 = self.create_project(teams=[self.team2])

        event1 = self.store_event(
            data={
                "fingerprint": ["group1"],
                "timestamp": iso_format(before_now(seconds=3)),
                "user": {"email": "foo@example.com"},
            },
            project_id=self.project1.id,
        )

        event2 = self.store_event(
            data={
                "fingerprint": ["group2"],
                "timestamp": iso_format(before_now(seconds=2)),
                "user": {"email": "bar@example.com"},
            },
            project_id=self.project1.id,
        )

        event3 = self.store_event(
            data={
                "fingerprint": ["group3"],
                "timestamp": iso_format(before_now(seconds=1)),
                "user": {"email": "foo@example.com"},
            },
            project_id=self.project2.id,
        )

        self.group1 = event1.group
        self.group2 = event2.group
        self.group3 = event3.group

        self.euser1 = EventUser.objects.get(email="foo@example.com", project_id=self.project1.id)
        self.euser2 = EventUser.objects.get(email="bar@example.com", project_id=self.project1.id)
        self.euser3 = EventUser.objects.get(email="foo@example.com", project_id=self.project2.id)

        self.path = reverse(
            "sentry-api-0-organization-user-issues", args=[self.org.slug, self.euser1.id]
        )

    def test_no_team_access(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org)
        self.login_as(user=user)

        response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_has_access(self):
        user = self.create_user()
        member = self.create_member(user=user, organization=self.org, teams=[self.team1])

        self.login_as(user=user)

        response = self.client.get(self.path)

        # result shouldn't include results from team2/project2 or bar@example.com
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(self.group1.id)

        OrganizationMemberTeam.objects.create(
            team=self.team2, organizationmember=member, is_active=True
        )

        response = self.client.get(self.path)

        # now result should include results from team2/project2
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["id"] == six.text_type(self.group3.id)
        assert response.data[1]["id"] == six.text_type(self.group1.id)
