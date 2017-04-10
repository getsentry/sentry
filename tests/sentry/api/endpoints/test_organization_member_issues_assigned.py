from __future__ import absolute_import

import six

from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.models import GroupAssignee, ProjectStatus
from sentry.testutils import APITestCase


class OrganizationMemberIssuesAssignedTest(APITestCase):
    def test_simple(self):
        now = timezone.now()
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
            date_added=now,
        )
        GroupAssignee.objects.create(
            group=group2,
            project=project1,
            user=user,
            date_added=now + timedelta(seconds=1),
        )
        # should not show up as project is pending removal
        GroupAssignee.objects.create(
            group=group3,
            project=project2,
            user=user,
            date_added=now + timedelta(seconds=2),
        )

        path = reverse('sentry-api-0-organization-member-issues-assigned', args=[org.slug, 'me'])

        self.login_as(user)

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert len(resp.data) == 2
        assert resp.data[0]['id'] == six.text_type(group2.id)
        assert resp.data[1]['id'] == six.text_type(group1.id)
