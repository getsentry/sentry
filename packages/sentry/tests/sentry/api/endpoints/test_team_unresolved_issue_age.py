from freezegun import freeze_time

from sentry.models import GroupAssignee, GroupEnvironment, GroupStatus
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


@freeze_time()
class TeamUnresolvedIssueAgeEndpointTest(APITestCase):
    endpoint = "sentry-api-0-team-unresolved-issue-age"

    def test_simple(self):
        other_user = self.create_user()
        other_team = self.create_team()
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        group1 = self.create_group(project=project1)
        group2 = self.create_group(project=project2, first_seen=before_now(days=20))
        group3 = self.create_group(project=project2, first_seen=before_now(weeks=100))
        group4 = self.create_group(project=project2, first_seen=before_now(weeks=60))
        # Not assigned, shouldn't count
        self.create_group(project=project2, first_seen=before_now(weeks=60))
        # Assigned but resolved, shouldn't count
        resolved_group = self.create_group(
            project=project2, status=GroupStatus.RESOLVED, first_seen=before_now(weeks=60)
        )
        # Assigned to another user, shouldn't count
        assigned_other_user = self.create_group(
            project=project2, status=GroupStatus.RESOLVED, first_seen=before_now(weeks=60)
        )
        # Assigned to another team, shouldn't count
        assigned_other_team = self.create_group(
            project=project2, status=GroupStatus.RESOLVED, first_seen=before_now(weeks=60)
        )
        # This group shouldn't be counted since it hasn't been seen for more than 90 days
        last_seen_too_old_group = self.create_group(project=project1, last_seen=before_now(days=91))
        GroupAssignee.objects.assign(group1, self.user)
        GroupAssignee.objects.assign(group2, self.user)
        GroupAssignee.objects.assign(group3, self.team)
        GroupAssignee.objects.assign(group4, self.user)
        GroupAssignee.objects.assign(last_seen_too_old_group, self.user)
        GroupAssignee.objects.assign(resolved_group, self.user)
        GroupAssignee.objects.assign(assigned_other_user, other_user)
        GroupAssignee.objects.assign(assigned_other_team, other_team)

        self.login_as(user=self.user)
        response = self.get_success_response(self.team.organization.slug, self.team.slug)
        assert response.data == {
            "< 1 hour": 1,
            "< 4 hour": 0,
            "< 12 hour": 0,
            "< 1 day": 0,
            "< 1 week": 0,
            "< 4 week": 1,
            "< 24 week": 0,
            "< 1 year": 0,
            "> 1 year": 2,
        }

    def test_environment_filter(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        env1 = self.create_environment(project=project1, name="prod")
        self.create_environment(project=project1, name="dev")
        group1 = self.create_group(project=project1)
        GroupEnvironment.objects.create(group_id=group1.id, environment_id=env1.id)
        GroupAssignee.objects.assign(group1, self.user)

        self.login_as(user=self.user)
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, environment="prod"
        )
        assert response.data == {
            "< 1 hour": 1,
            "< 4 hour": 0,
            "< 12 hour": 0,
            "< 1 day": 0,
            "< 1 week": 0,
            "< 4 week": 0,
            "< 24 week": 0,
            "< 1 year": 0,
            "> 1 year": 0,
        }

        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, environment="dev"
        )
        assert response.data == {
            "< 1 hour": 0,
            "< 4 hour": 0,
            "< 12 hour": 0,
            "< 1 day": 0,
            "< 1 week": 0,
            "< 4 week": 0,
            "< 24 week": 0,
            "< 1 year": 0,
            "> 1 year": 0,
        }

    def test_empty(self):
        self.login_as(user=self.user)
        response = self.get_success_response(self.team.organization.slug, self.team.slug)
        assert response.data == {
            "< 1 hour": 0,
            "< 4 hour": 0,
            "< 12 hour": 0,
            "< 1 day": 0,
            "< 1 week": 0,
            "< 4 week": 0,
            "< 24 week": 0,
            "< 1 year": 0,
            "> 1 year": 0,
        }
