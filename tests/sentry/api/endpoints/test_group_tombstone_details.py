from __future__ import absolute_import, print_function
from django.core.urlresolvers import reverse

from sentry.models import GroupHash, GroupTombstone
from sentry.testutils import APITestCase


class GroupTombstoneDetailsTest(APITestCase):
    def test_delete(self):
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(user=self.user)

        group = self.create_group()
        tombstone = GroupTombstone.objects.create(
            project_id=group.project_id,
            level=group.level,
            message=group.message,
            culprit=group.culprit,
            data=group.data,
            previous_group_id=group.id,
        )
        GroupHash.objects.create(
            project=group.project, hash="x" * 32, group=group, group_tombstone_id=tombstone.id
        )
        assert GroupHash.objects.filter(group_tombstone_id=tombstone.id).exists()
        path = reverse(
            "sentry-api-0-group-tombstone-details",
            kwargs={
                "organization_slug": self.org.slug,
                "project_slug": self.project.slug,
                "tombstone_id": tombstone.id,
            },
        )
        response = self.client.delete(path)

        assert response.status_code == 204, response
        assert not GroupHash.objects.filter(group_tombstone_id=tombstone.id).exists()

    def test_dont_delete_from_other_proj(self):
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")

        self.other_project = self.create_project(
            organization=self.org, teams=[self.team], name="Snake"
        )

        self.login_as(user=self.user)

        group = self.create_group()
        tombstone = GroupTombstone.objects.create(
            project_id=group.project_id,
            level=group.level,
            message=group.message,
            culprit=group.culprit,
            data=group.data,
            previous_group_id=group.id,
        )
        GroupHash.objects.create(
            project=group.project, hash="x" * 32, group=group, group_tombstone_id=tombstone.id
        )
        assert GroupHash.objects.filter(group_tombstone_id=tombstone.id).exists()
        path = reverse(
            "sentry-api-0-group-tombstone-details",
            kwargs={
                "organization_slug": self.org.slug,
                "project_slug": self.other_project.slug,
                "tombstone_id": tombstone.id,
            },
        )
        response = self.client.delete(path)

        assert response.status_code == 404, response
        assert GroupHash.objects.filter(group_tombstone_id=tombstone.id).exists()
        assert GroupTombstone.objects.filter(project_id=self.project.id, id=tombstone.id).exists()
