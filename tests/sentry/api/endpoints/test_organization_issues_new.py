from __future__ import absolute_import

from sentry.models import OrganizationMember, OrganizationMemberTeam
from sentry.testutils import APITestCase


class OrganizationIssuesNewTest(APITestCase):
    def test_simple(self):
        user = self.create_user('foo@example.com')
        org = self.create_organization(owner=user)
        project1 = self.create_project(organization=org, name='foo')
        project2 = self.create_project(organization=org, name='bar')
        group1 = self.create_group(checksum='a' * 32, project=project1, score=10)
        group2 = self.create_group(checksum='b' * 32, project=project2, score=5)
        member = OrganizationMember.objects.get(
            user=user,
            organization=org,
        )
        OrganizationMemberTeam.objects.create(
            organizationmember=member,
            team=project1.team,
        )

        self.login_as(user=user)

        url = '/api/0/organizations/{}/issues/new/'.format(
            org.slug,
        )
        response = self.client.get(url, format='json')
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['id'] == str(group2.id)
        assert response.data[1]['id'] == str(group1.id)
