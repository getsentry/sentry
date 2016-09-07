from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.models import EventUser, GroupTagValue, OrganizationMemberTeam
from sentry.testutils import APITestCase


class OrganizationUserIssuesSearchTest(APITestCase):
    def setUp(self):
        super(OrganizationUserIssuesSearchTest, self).setUp()
        self.org = self.create_organization()
        self.org.flags.allow_joinleave = False
        self.org.save()
        self.team1 = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)
        self.project1 = self.create_project(team=self.team1)
        self.project2 = self.create_project(team=self.team2)
        group1 = self.create_group(project=self.project1,
                                   last_seen=timezone.now() - timedelta(minutes=1))
        group2 = self.create_group(project=self.project2)

        EventUser.objects.create(email='foo@example.com', project=self.project1)
        EventUser.objects.create(email='bar@example.com', project=self.project1)
        EventUser.objects.create(email='foo@example.com', project=self.project2)

        GroupTagValue.objects.create(key='sentry:user',
                                     value='email:foo@example.com',
                                     group=group1,
                                     project=self.project1)
        GroupTagValue.objects.create(key='sentry:user',
                                     value='email:bar@example.com',
                                     group=group1,
                                     project=self.project1)
        GroupTagValue.objects.create(key='sentry:user',
                                     value='email:foo@example.com',
                                     group=group2,
                                     project=self.project2)

    def get_url(self):
        return reverse('sentry-api-0-organization-issue-search', args=[self.org.slug])

    def test_no_team_access(self):
        user = self.create_user()
        self.create_member(user=user, organization=self.org)
        self.login_as(user=user)

        url = '%s?%s' % (self.get_url(), urlencode({'email': 'foo@example.com'}))

        response = self.client.get(url, format='json')
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_has_access(self):
        user = self.create_user()
        member = self.create_member(user=user, organization=self.org)
        self.login_as(user=user)

        OrganizationMemberTeam.objects.create(
            team=self.team1,
            organizationmember=member,
            is_active=True,
        )

        url = '%s?%s' % (self.get_url(), urlencode({'email': 'foo@example.com'}))
        response = self.client.get(url, format='json')

        # result shouldn't include results from team2/project2 or bar@example.com
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['project']['slug'] == self.project1.slug

        OrganizationMemberTeam.objects.create(
            team=self.team2,
            organizationmember=member,
            is_active=True,
        )

        response = self.client.get(url, format='json')

        # now result should include results from team2/project2
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['project']['slug'] == self.project2.slug
        assert response.data[1]['project']['slug'] == self.project1.slug
