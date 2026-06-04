from datetime import UTC, datetime, timedelta

from sentry.models.group import GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupenvironment import GroupEnvironment
from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class TeamGroupsOldTest(APITestCase):
    endpoint = "sentry-api-0-team-oldest-issues"

    def test_simple(self) -> None:
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        group1 = self.create_group(
            project=project1,
            first_seen=datetime(2018, 1, 12, 3, 8, 25, tzinfo=UTC),
        )
        group2 = self.create_group(
            project=project2,
            first_seen=datetime(2015, 1, 12, 3, 8, 25, tzinfo=UTC),
        )
        resolved_group = self.create_group(project=project2, status=GroupStatus.RESOLVED)
        GroupAssignee.objects.assign(group1, self.user)
        GroupAssignee.objects.assign(group2, self.user)
        GroupAssignee.objects.assign(resolved_group, self.user)

        other_user = self.create_user()
        assigned_to_other = self.create_group(
            project=project2,
            first_seen=datetime(2015, 1, 12, 3, 8, 25, tzinfo=UTC),
        )
        GroupAssignee.objects.assign(assigned_to_other, other_user)
        self.create_group(
            project=project2,
            first_seen=datetime(2015, 1, 12, 3, 8, 25, tzinfo=UTC),
        )

        # Should be excluded since it hasn't been seen for over 90 days.
        last_seen_too_old_group = self.create_group(
            project=project1,
            first_seen=datetime(2018, 1, 12, 3, 8, 25, tzinfo=UTC),
            last_seen=datetime.now(UTC) - timedelta(days=91),
        )
        GroupAssignee.objects.assign(last_seen_too_old_group, self.user)

        self.login_as(user=self.user)
        response = self.get_success_response(self.organization.slug, self.team.slug)
        assert [group["id"] for group in response.data] == [str(group2.id), str(group1.id)]

    def test_filter_by_environment(self) -> None:
        project1 = self.create_project(teams=[self.team], slug="foo")
        environment = self.create_environment(name="prod", project=project1)
        self.create_environment(name="dev", project=project1)
        group1 = self.create_group(
            project=project1,
            first_seen=datetime(2018, 1, 12, 3, 8, 25, tzinfo=UTC),
        )
        GroupAssignee.objects.assign(group1, self.user)
        GroupEnvironment.objects.create(group_id=group1.id, environment_id=environment.id)

        self.login_as(user=self.user)
        response = self.get_success_response(
            self.organization.slug, self.team.slug, environment="prod"
        )
        assert [group["id"] for group in response.data] == [str(group1.id)]

        response = self.get_success_response(
            self.organization.slug, self.team.slug, environment="dev"
        )
        assert [group["id"] for group in response.data] == []
