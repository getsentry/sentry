from django.urls import reverse

from sentry.models.grouphash import GroupHash
from sentry.models.grouptombstone import GroupTombstone
from sentry.testutils.cases import APITestCase


class GroupTombstoneTest(APITestCase):
    def test_simple(self) -> None:
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        group = self.create_group(project=self.project)
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

        path = reverse(
            "sentry-api-0-group-tombstones",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

        response = self.client.get(path)
        assert response.status_code == 200, response
        assert response.data[0]["message"] == group.message

    def test_filter_by_issue_group_id(self) -> None:
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)

        # Create two groups and their tombstones
        group1 = self.create_group(project=self.project, message="First group")
        tombstone1 = GroupTombstone.objects.create(
            project_id=group1.project_id,
            level=group1.level,
            message=group1.message,
            culprit=group1.culprit,
            data=group1.data,
            previous_group_id=group1.id,
        )

        group2 = self.create_group(project=self.project, message="Second group")
        tombstone2 = GroupTombstone.objects.create(
            project_id=group2.project_id,
            level=group2.level,
            message=group2.message,
            culprit=group2.culprit,
            data=group2.data,
            previous_group_id=group2.id,
        )

        path = reverse(
            "sentry-api-0-group-tombstones",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

        # Test filtering by first group's ID
        response = self.client.get(path, {"issue_group_id": group1.id})
        assert response.status_code == 200, response
        assert len(response.data) == 1
        assert response.data[0]["message"] == group1.message
        assert response.data[0]["id"] == str(tombstone1.id)

        # Test filtering by second group's ID
        response = self.client.get(path, {"issue_group_id": group2.id})
        assert response.status_code == 200, response
        assert len(response.data) == 1
        assert response.data[0]["message"] == group2.message
        assert response.data[0]["id"] == str(tombstone2.id)

        # Test filtering by non-existent group ID
        response = self.client.get(path, {"issue_group_id": 999999})
        assert response.status_code == 200, response
        assert len(response.data) == 0

    def test_filter_by_invalid_issue_group_id(self) -> None:
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)

        path = reverse(
            "sentry-api-0-group-tombstones",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

        # Test with invalid (non-numeric) issue_group_id
        response = self.client.get(path, {"issue_group_id": "invalid"})
        assert response.status_code == 400, response
        assert response.data["detail"] == "Invalid issue_group_id parameter"
