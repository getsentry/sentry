from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import GroupAssignee, ProjectStatus
from sentry.testutils import APITestCase


class OrganizationMemberIssuesAssignedTest(APITestCase):
    def test_simple(self):
        user = self.create_user('foo@example.com')
        org = self.create_organization(name='foo')
        team = self.create_team(name='foo', organization=org)
        self.create_member(
            organization=org,
            user=user,
            role='admin',
            teams=[team],
        )
        project1 = self.create_project(name='foo', organization=org, team=team)
        group1 = self.create_group(project=project1)
        group2 = self.create_group(project=project1)
        project2 = self.create_project(name='bar', organization=org, team=team,
                                       status=ProjectStatus.PENDING_DELETION)
        group3 = self.create_group(project=project2)
        GroupAssignee.objects.create(
            group=group1,
            project=project1,
            user=user,
        )
        GroupAssignee.objects.create(
            group=group2,
            project=project1,
            user=user,
        )
        # should not show up as project is pending removal
        GroupAssignee.objects.create(
            group=group3,
            project=project2,
            user=user,
        )

        path = reverse('sentry-api-0-organization-member-issues-assigned', args=[org.slug, 'me'])

        self.login_as(user)

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert len(resp.data) == 2
        assert resp.data[0]['id'] == str(group2.id)
        assert resp.data[1]['id'] == str(group1.id)
