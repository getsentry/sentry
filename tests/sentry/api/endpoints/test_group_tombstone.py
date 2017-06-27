from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse

from sentry.models import GroupHash, GroupTombstone
from sentry.testutils import APITestCase


class GroupTombstoneTest(APITestCase):

    def test_simple(self):
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            owner=self.user,
            name='Rowdy Tiger'
        )
        self.team = self.create_team(
            organization=self.org,
            name='Mariachi Band'
        )
        self.project = self.create_project(
            organization=self.org,
            team=self.team,
            name='Bengal',
        )
        self.login_as(self.user)
        group = self.create_group(project=self.project)
        tombstone = GroupTombstone.objects.create(
            project_id=group.project_id,
            level=group.level,
            message=group.message,
            culprit=group.culprit,
            type=group.get_event_type(),
        )
        GroupHash.objects.create(
            project=group.project,
            hash='x' * 32,
            group=group,
            group_tombstone=tombstone
        )

        path = reverse('sentry-api-0-group-tombstone',
            kwargs={
                'organization_slug': self.org.slug,
                'project_slug': self.project.slug,
            }
        )

        response = self.client.get(path)
        assert response.status_code == 200, response
        assert response.data[0]['message'] == group.message
        assert response.data[0]['project']['name'] == self.project.name
