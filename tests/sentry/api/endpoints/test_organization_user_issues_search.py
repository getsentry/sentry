from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from django.core.urlresolvers import reverse

from sentry.models import EventUser, GroupTagValue, OrganizationMemberTeam
from sentry.testutils import APITestCase


class OrganizationUserIssuesSearchTest(APITestCase):
    def test_simple(self):
        org = self.create_organization(name='baz')
        org.flags.allow_joinleave = False
        org.save()
        team = self.create_team(organization=org)
        project1 = self.create_project(team=team)
        project2 = self.create_project(team=team)
        group1 = self.create_group(project=project1)
        group2 = self.create_group(project=project2)

        user = self.create_user()
        member = self.create_member(user=user, organization=org)
        self.login_as(user=user)

        EventUser.objects.create(email='foo@example.com', project=project1)
        EventUser.objects.create(email='foo@example.com', project=project2)

        GroupTagValue.objects.create(key='sentry:user',
                                     value='email:foo@example.com',
                                     group=group1,
                                     project=project1)
        GroupTagValue.objects.create(key='sentry:user',
                                     value='email:foo@example.com',
                                     group=group2,
                                     project=project2)

        url = reverse('sentry-api-0-organization-issue-search', args=[org.slug])
        url = '%s?%s' % (url, urlencode({'email': 'foo@example.com'}))

        # User has no team/project access yet
        response = self.client.get(url, format='json')
        assert response.status_code == 200
        assert len(response.data) == 0

        OrganizationMemberTeam.objects.create(
            team=team,
            organizationmember=member,
            is_active=True,
        )

        response = self.client.get(url, format='json')

        # now user has team/project access
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['project']['slug'] == project2.slug
        assert response.data[1]['project']['slug'] == project1.slug
