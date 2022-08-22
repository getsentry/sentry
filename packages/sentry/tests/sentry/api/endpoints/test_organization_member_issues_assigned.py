from datetime import timedelta

from django.utils import timezone

from sentry.models import GroupAssignee, OrganizationMemberTeam, ProjectStatus
from sentry.testutils import APITestCase


class OrganizationMemberIssuesAssignedTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-issues-assigned"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.now = timezone.now()

        self.group = self.create_group(project=self.project)
        GroupAssignee.objects.create(
            group=self.group,
            project=self.project,
            user=self.user,
            date_added=self.now,
        )

    def test_simple(self):
        group2 = self.create_group(project=self.project)
        GroupAssignee.objects.create(
            group=group2,
            project=self.project,
            user=self.user,
            date_added=self.now + timedelta(seconds=1),
        )

        project2 = self.create_project(
            name="project_2",
            organization=self.organization,
            teams=[self.team],
            status=ProjectStatus.PENDING_DELETION,
        )
        group3 = self.create_group(project=project2)
        # This should not show up because project is pending removal.
        GroupAssignee.objects.create(
            group=group3,
            project=project2,
            user=self.user,
            date_added=self.now + timedelta(seconds=2),
        )

        response = self.get_success_response(self.organization.slug, "me")

        assert len(response.data) == 2
        assert response.data[0]["id"] == str(group2.id)
        assert response.data[1]["id"] == str(self.group.id)

    def test_via_team(self):
        response = self.get_success_response(self.organization.slug, "me")

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.group.id)

    def test_team_does_not_return_all_org_teams_for_owners(self):
        # Remove the team that has access to self.group.
        OrganizationMemberTeam.objects.filter(
            organizationmember__organization=self.organization,
            organizationmember__user=self.user,
        ).delete()

        response = self.get_success_response(self.organization.slug, "me")

        assert len(response.data) == 0
