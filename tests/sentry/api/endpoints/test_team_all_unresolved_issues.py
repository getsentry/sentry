from datetime import datetime, timedelta

from django.utils import timezone
from django.utils.timezone import now
from freezegun import freeze_time

from sentry.models import (
    GroupAssignee,
    GroupEnvironment,
    GroupHistory,
    GroupHistoryStatus,
    GroupStatus,
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


@freeze_time(datetime(2021, 6, 24, 4, 00))
class TeamIssueBreakdownTest(APITestCase):
    endpoint = "sentry-api-0-team-all-unresolved-issues"

    def test_status_format(self):
        project1 = self.create_project(teams=[self.team])
        group1_1 = self.create_group(project=project1, first_seen=before_now(days=40))
        group1_2 = self.create_group(project=project1, first_seen=before_now(days=5))
        group1_3 = self.create_group(
            project=project1,
            first_seen=before_now(days=40),
            status=GroupStatus.RESOLVED,
            resolved_at=before_now(days=35),
        )
        group1_4 = self.create_group(
            project=project1,
            first_seen=before_now(days=40),
            status=GroupStatus.RESOLVED,
            resolved_at=before_now(days=9),
        )
        group1_5 = self.create_group(project=project1, first_seen=before_now(days=40))
        # Should be excluded from counts even though it has no group history row
        group1_6 = self.create_group(
            project=project1, first_seen=before_now(days=41), status=GroupStatus.IGNORED
        )
        # Should be excluded from initial counts because it has a regressed status without a
        # corresponding resolved status
        group1_7 = self.create_group(project=project1, first_seen=before_now(days=40))
        group1_8 = self.create_group(
            project=project1, first_seen=before_now(days=40), status=GroupStatus.UNRESOLVED
        )
        GroupAssignee.objects.assign(group1_1, self.user)
        GroupAssignee.objects.assign(group1_2, self.user)
        GroupAssignee.objects.assign(group1_3, self.user)
        GroupAssignee.objects.assign(group1_4, self.user)
        GroupAssignee.objects.assign(group1_5, self.user)
        GroupAssignee.objects.assign(group1_6, self.user)
        GroupAssignee.objects.assign(group1_7, self.user)
        GroupAssignee.objects.assign(group1_8, self.user)
        GroupHistory.objects.all().delete()

        self.create_group_history(
            group=group1_1, date_added=before_now(days=5), status=GroupHistoryStatus.RESOLVED
        )
        # Duplicate statuses shouldn't count multiple times.
        self.create_group_history(
            group=group1_1,
            date_added=before_now(days=4, hours=10),
            status=GroupHistoryStatus.RESOLVED,
        )
        self.create_group_history(
            group=group1_1,
            date_added=before_now(days=4, hours=8),
            status=GroupHistoryStatus.RESOLVED,
        )
        self.create_group_history(
            group=group1_1, date_added=before_now(days=3), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group1_2, date_added=before_now(days=3), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group1_2,
            date_added=before_now(days=2, hours=23),
            status=GroupHistoryStatus.REGRESSED,
        )
        self.create_group_history(
            group=group1_4, date_added=before_now(days=9), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group1_4,
            date_added=before_now(days=8, hours=7),
            status=GroupHistoryStatus.RESOLVED,
        )
        self.create_group_history(
            group=group1_4,
            date_added=before_now(days=8, hours=6),
            status=GroupHistoryStatus.RESOLVED,
        )
        self.create_group_history(
            group=group1_7,
            date_added=before_now(days=1),
            status=GroupHistoryStatus.REGRESSED,
        )
        self.create_group_history(
            group=group1_8,
            date_added=before_now(days=8, hours=0),
            status=GroupHistoryStatus.RESOLVED,
        )
        project2 = self.create_project(teams=[self.team])
        group2_1 = self.create_group(
            project=project2, first_seen=before_now(days=40), status=GroupStatus.RESOLVED
        )
        GroupAssignee.objects.assign(group2_1, self.user)
        self.create_group_history(
            group=group2_1, date_added=before_now(days=6), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group2_1, date_added=before_now(days=5), status=GroupHistoryStatus.REGRESSED
        )
        self.create_group_history(
            group=group2_1, date_added=before_now(days=4), status=GroupHistoryStatus.IGNORED
        )
        self.create_group_history(
            group=group2_1, date_added=before_now(days=3), status=GroupHistoryStatus.UNIGNORED
        )
        self.create_group_history(
            group=group2_1,
            date_added=before_now(days=2),
            status=GroupHistoryStatus.SET_RESOLVED_IN_RELEASE,
        )
        self.create_group_history(
            group=group2_1, date_added=before_now(days=1), status=GroupHistoryStatus.REGRESSED
        )
        self.create_group_history(
            group=group2_1, date_added=before_now(days=0), status=GroupHistoryStatus.RESOLVED
        )

        project3 = self.create_project(teams=[self.team])
        group3_1 = self.create_group(
            project=project3, first_seen=before_now(days=5), status=GroupStatus.RESOLVED
        )
        GroupAssignee.objects.assign(group3_1, self.user)
        self.create_group_history(
            group=group3_1, date_added=before_now(days=4), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group3_1, date_added=before_now(days=4), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group3_1, date_added=before_now(days=4), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group3_1, date_added=before_now(days=4), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group3_1, date_added=before_now(days=4), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group3_1, date_added=before_now(days=4), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group3_1, date_added=before_now(days=4), status=GroupHistoryStatus.RESOLVED
        )

        self.login_as(user=self.user)
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="7d"
        )

        def compare_response(response, project, expected_results):
            start = (now() - timedelta(days=len(expected_results) - 1)).replace(
                hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
            )
            expected = {
                (start + timedelta(days=i)).isoformat(): {"unresolved": value}
                for i, value in enumerate(expected_results)
            }
            assert expected == response.data[project.id]

        compare_response(response, project1, [3, 3, 3, 4, 4, 5, 5])
        compare_response(response, project2, [0, 1, 0, 1, 0, 1, 0])
        compare_response(response, project3, [0, 1, 0, 0, 0, 0, 0])

    def test_status_format_with_environment(self):
        project1 = self.create_project(teams=[self.team])
        env1 = self.create_environment(name="development", project=project1)
        env2 = self.create_environment(name="production", project=project1)
        group1_1 = self.create_group(project_id=project1.id, first_seen=before_now(days=40))
        group1_2 = self.create_group(project_id=project1.id, first_seen=before_now(days=40))
        group1_3 = self.create_group(project_id=project1.id, first_seen=before_now(days=40))
        GroupEnvironment.objects.create(group_id=group1_1.id, environment_id=env2.id)
        GroupEnvironment.objects.create(group_id=group1_2.id, environment_id=env2.id)
        GroupEnvironment.objects.create(group_id=group1_3.id, environment_id=env1.id)
        GroupAssignee.objects.assign(group1_1, self.user)
        GroupAssignee.objects.assign(group1_2, self.user)
        GroupAssignee.objects.assign(group1_3, self.user)
        GroupHistory.objects.all().delete()

        self.create_group_history(
            group=group1_1, date_added=before_now(days=40), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group1_2, date_added=before_now(days=40), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group1_3, date_added=before_now(days=40), status=GroupHistoryStatus.UNRESOLVED
        )

        self.login_as(user=self.user)
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="7d", environment="production"
        )

        def compare_response(response, project, expected_results):
            start = (now() - timedelta(days=len(expected_results) - 1)).replace(
                hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
            )
            expected = {
                (start + timedelta(days=i)).isoformat(): {"unresolved": value}
                for i, value in enumerate(expected_results)
            }
            assert expected == response.data[project.id]

        compare_response(response, project1, [2, 2, 2, 2, 2, 2, 2])

        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="7d"
        )

        compare_response(response, project1, [3, 3, 3, 3, 3, 3, 3])

    def test_no_projects(self):
        self.login_as(user=self.user)
        self.get_success_response(self.team.organization.slug, self.team.slug, statsPeriod="7d")

    def test_no_group_history(self):
        project1 = self.create_project(teams=[self.team])
        group1_1 = self.create_group(project=project1, first_seen=before_now(days=40))
        GroupAssignee.objects.assign(group1_1, self.user)
        GroupHistory.objects.all().delete()

        self.login_as(user=self.user)
        self.get_success_response(self.team.organization.slug, self.team.slug, statsPeriod="7d")
