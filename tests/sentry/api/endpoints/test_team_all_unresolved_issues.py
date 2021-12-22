from datetime import timedelta

from django.utils import timezone
from django.utils.timezone import now
from freezegun import freeze_time

from sentry.models import GroupAssignee, GroupHistory, GroupHistoryStatus
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


@freeze_time()
class TeamIssueBreakdownTest(APITestCase):
    endpoint = "sentry-api-0-team-all-unresolved-issues"

    def test_status_format(self):
        project1 = self.create_project(teams=[self.team])
        group1_1 = self.create_group(project=project1, first_seen=before_now(days=40))
        group1_2 = self.create_group(project=project1, first_seen=before_now(days=5))
        group1_3 = self.create_group(
            project=project1, first_seen=before_now(days=40), resolved_at=before_now(days=35)
        )
        group1_4 = self.create_group(
            project=project1, first_seen=before_now(days=40), resolved_at=before_now(days=9)
        )
        group1_5 = self.create_group(project=project1, first_seen=before_now(days=40))
        GroupAssignee.objects.assign(group1_1, self.user)
        GroupAssignee.objects.assign(group1_2, self.user)
        GroupAssignee.objects.assign(group1_3, self.user)
        GroupAssignee.objects.assign(group1_4, self.user)
        GroupAssignee.objects.assign(group1_5, self.user)
        GroupHistory.objects.all().delete()

        self.create_group_history(
            group=group1_1, date_added=before_now(days=5), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group1_1, date_added=before_now(days=3), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group1_2, date_added=before_now(days=3), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group1_2, date_added=before_now(days=3), status=GroupHistoryStatus.REGRESSED
        )
        self.create_group_history(
            group=group1_4, date_added=before_now(days=9), status=GroupHistoryStatus.RESOLVED
        )
        project2 = self.create_project(teams=[self.team])
        group2_1 = self.create_group(project=project2, first_seen=before_now(days=40))
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
        group3_1 = self.create_group(project=project3, first_seen=before_now(days=5))
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

        compare_response(response, project1, [2, 2, 2, 3, 3, 3, 3])
        compare_response(response, project2, [0, 1, 0, 1, 0, 1, 0])
        compare_response(response, project3, [0, 1, 0, 0, 0, 0, 0])
