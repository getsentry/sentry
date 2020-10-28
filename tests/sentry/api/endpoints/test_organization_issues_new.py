from __future__ import absolute_import

import six

from datetime import timedelta
from django.utils import timezone

from sentry.models import OrganizationMember, OrganizationMemberTeam
from sentry.testutils import APITestCase


class OrganizationIssuesNewTest(APITestCase):
    def test_simple(self):
        now = timezone.now()
        user = self.create_user("foo@example.com")
        org = self.create_organization(owner=user)
        project1 = self.create_project(organization=org, name="foo")
        project2 = self.create_project(organization=org, name="bar")
        group1 = self.create_group(checksum="a" * 32, project=project1, score=10, first_seen=now)
        group2 = self.create_group(
            checksum="b" * 32, project=project2, score=5, first_seen=now + timedelta(seconds=1)
        )
        member = OrganizationMember.objects.get(user=user, organization=org)
        OrganizationMemberTeam.objects.create(
            organizationmember=member, team=project1.teams.first()
        )

        self.login_as(user=user)

        url = u"/api/0/organizations/{}/issues/new/".format(org.slug)
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["id"] == six.text_type(group2.id)
        assert response.data[1]["id"] == six.text_type(group1.id)
