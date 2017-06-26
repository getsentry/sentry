from __future__ import absolute_import, print_function

from sentry.models import GroupHash, GroupTombstone
from sentry.testutils import APITestCase


class GroupTombstoneTest(APITestCase):

    def test_simple(self):
        # import pdb; pdb.set_trace()
        self.login_as(user=self.user)
        org = self.create_organization(
            owner=self.user,
        )
        project = self.create_project(
            organization=org,
            name='CoolProj',
        )
        group = self.create_group(project=project)
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

        path = '/api/0/projects/{}/{}/tombstone/'.format(org.id, project.id)
        response = self.client.get(path)

        assert response.status_code == 200, response
        assert response.data[0]['message'] == group.message
        assert response.data[0]['project']['name'] == project.name
