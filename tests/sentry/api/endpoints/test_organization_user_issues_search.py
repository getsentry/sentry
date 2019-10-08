from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from django.core.urlresolvers import reverse

from sentry.models import OrganizationMemberTeam
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class OrganizationUserIssuesSearchTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationUserIssuesSearchTest, self).setUp()
        self.org = self.create_organization(owner=None)
        self.org.flags.allow_joinleave = False
        self.org.save()
        self.team1 = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)
        self.project1 = self.create_project(teams=[self.team1])
        self.project2 = self.create_project(teams=[self.team2])

        self.store_event(
            data={
                "user": {"email": "foo@example.com"},
                "fingerprint": ["group1"],
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project1.id,
        )

        self.store_event(
            data={
                "user": {"email": "bar@example.com"},
                "fingerprint": ["group1"],
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project1.id,
        )

        self.store_event(
            data={
                "user": {"email": "foo@example.com"},
                "fingerprint": ["group2"],
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project2.id,
        )

    def get_url(self):
        return reverse("sentry-api-0-organization-issue-search", args=[self.org.slug])

    def test_no_team_access(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org)
        self.login_as(user=user)

        url = "%s?%s" % (self.get_url(), urlencode({"email": "foo@example.com"}))

        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_has_access(self):
        user = self.create_user()
        member = self.create_member(user=user, organization=self.org)
        self.login_as(user=user)

        OrganizationMemberTeam.objects.create(
            team=self.team1, organizationmember=member, is_active=True
        )

        url = "%s?%s" % (self.get_url(), urlencode({"email": "foo@example.com"}))
        response = self.client.get(url, format="json")
        # result shouldn't include results from team2/project2 or bar@example.com
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["project"]["slug"] == self.project1.slug

        OrganizationMemberTeam.objects.create(
            team=self.team2, organizationmember=member, is_active=True
        )

        response = self.client.get(url, format="json")

        # now result should include results from team2/project2
        assert response.status_code == 200
        assert len(response.data) == 2
        assert set([r["project"]["slug"] for r in response.data]) == set(
            [self.project1.slug, self.project2.slug]
        )
