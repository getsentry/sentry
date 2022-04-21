from datetime import timedelta

from django.utils import timezone
from django.utils.timezone import now
from freezegun import freeze_time

from sentry.models import GroupAssignee, GroupEnvironment, GroupHistoryStatus
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


@freeze_time()
class TeamIssueBreakdownTest(APITestCase):
    endpoint = "sentry-api-0-team-issue-breakdown"

    def test_status_format(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        group1 = self.create_group(checksum="a" * 32, project=project1)
        group2 = self.create_group(checksum="b" * 32, project=project2)
        GroupAssignee.objects.assign(group1, self.user)
        GroupAssignee.objects.assign(group2, self.user)

        self.create_group_history(
            group=group1, date_added=before_now(days=5), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group1, date_added=before_now(days=2), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group1, date_added=before_now(days=2), status=GroupHistoryStatus.REGRESSED
        )
        self.create_group_history(
            group=group2, date_added=before_now(days=10), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group2, date_added=before_now(days=1), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(group=group2, status=GroupHistoryStatus.RESOLVED)
        self.create_group_history(group=group2, status=GroupHistoryStatus.RESOLVED)
        self.create_group_history(group=group2, status=GroupHistoryStatus.IGNORED)

        today = str(
            now()
            .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            .isoformat()
        )
        yesterday = str(
            (now() - timedelta(days=1))
            .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            .isoformat()
        )
        two_days_ago = str(
            (now() - timedelta(days=2))
            .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            .isoformat()
        )
        self.login_as(user=self.user)
        statuses = ["resolved", "regressed", "unresolved", "ignored"]
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="7d", statuses=statuses
        )

        def compare_response(statuses, data_for_day, **expected_status_counts):
            result = {status: 0 for status in statuses}
            result["total"] = 0
            result.update(expected_status_counts)
            assert result == data_for_day

        compare_response(statuses, response.data[project1.id][today])
        compare_response(statuses, response.data[project1.id][yesterday])
        compare_response(
            statuses, response.data[project1.id][two_days_ago], regressed=1, resolved=1, total=2
        )
        compare_response(
            statuses, response.data[project2.id][today], ignored=1, resolved=2, total=3
        )
        compare_response(statuses, response.data[project2.id][yesterday], unresolved=1, total=1)
        compare_response(statuses, response.data[project2.id][two_days_ago])

        statuses = ["resolved"]
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="7d", statuses=statuses
        )
        compare_response(statuses, response.data[project1.id][today])
        compare_response(statuses, response.data[project1.id][yesterday])
        compare_response(statuses, response.data[project1.id][two_days_ago], resolved=1, total=1)
        compare_response(statuses, response.data[project2.id][today], resolved=2, total=2)
        compare_response(statuses, response.data[project2.id][yesterday])
        compare_response(statuses, response.data[project2.id][two_days_ago])

        statuses = ["resolved", "new"]
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="7d", statuses=statuses
        )
        compare_response(statuses, response.data[project1.id][today], new=1, total=1)
        compare_response(statuses, response.data[project1.id][yesterday])
        compare_response(statuses, response.data[project1.id][two_days_ago], resolved=1, total=1)
        compare_response(statuses, response.data[project2.id][today], new=1, resolved=2, total=3)
        compare_response(statuses, response.data[project2.id][yesterday])
        compare_response(statuses, response.data[project2.id][two_days_ago])

    def test_filter_by_environment(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        group1 = self.create_group(checksum="a" * 32, project=project1)
        env1 = self.create_environment(name="prod", project=project1)
        self.create_environment(name="dev", project=project1)
        GroupAssignee.objects.assign(group1, self.user)
        GroupEnvironment.objects.create(group_id=group1.id, environment_id=env1.id)

        self.create_group_history(
            group=group1, date_added=now(), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group1, date_added=now(), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group1, date_added=now(), status=GroupHistoryStatus.REGRESSED
        )

        today = str(
            now()
            .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            .isoformat()
        )
        self.login_as(user=self.user)
        statuses = ["regressed", "resolved"]
        response = self.get_success_response(
            self.team.organization.slug,
            self.team.slug,
            statsPeriod="7d",
            statuses=statuses,
            environment="prod",
        )

        def compare_response(statuses, data_for_day, **expected_status_counts):
            result = {status: 0 for status in statuses}
            result["total"] = 0
            result.update(expected_status_counts)
            assert result == data_for_day

        compare_response(
            statuses, response.data[project1.id][today], regressed=1, resolved=1, total=2
        )

        response = self.get_success_response(
            self.team.organization.slug,
            self.team.slug,
            statsPeriod="7d",
            statuses=statuses,
            environment="dev",
        )
        compare_response(statuses, response.data[project1.id][today])

    def test_old_format(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        group1 = self.create_group(checksum="a" * 32, project=project1, times_seen=10)
        group2 = self.create_group(checksum="b" * 32, project=project2, times_seen=5)
        GroupAssignee.objects.assign(group1, self.user)
        GroupAssignee.objects.assign(group2, self.user)

        self.create_group_history(
            group=group1, date_added=before_now(days=5), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group1, date_added=before_now(days=2), status=GroupHistoryStatus.RESOLVED
        )
        self.create_group_history(
            group=group1, date_added=before_now(days=2), status=GroupHistoryStatus.REGRESSED
        )
        self.create_group_history(
            group=group2, date_added=before_now(days=10), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(
            group=group2, date_added=before_now(days=1), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(group=group2, status=GroupHistoryStatus.RESOLVED)
        self.create_group_history(group=group2, status=GroupHistoryStatus.RESOLVED)
        self.create_group_history(group=group2, status=GroupHistoryStatus.IGNORED)

        today = str(
            now()
            .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            .isoformat()
        )
        yesterday = str(
            (now() - timedelta(days=1))
            .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            .isoformat()
        )
        two_days_ago = str(
            (now() - timedelta(days=2))
            .replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            .isoformat()
        )
        self.login_as(user=self.user)
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="7d"
        )
        assert len(response.data) == 2
        assert response.data[project1.id][today]["reviewed"] == 0
        assert response.data[project1.id][today]["total"] == 0
        assert response.data[project1.id][yesterday]["reviewed"] == 0
        assert response.data[project1.id][yesterday]["total"] == 0
        assert response.data[project1.id][two_days_ago]["reviewed"] == 1
        assert response.data[project1.id][two_days_ago]["reviewed"] == 1

        assert response.data[project2.id][today]["reviewed"] == 3
        assert response.data[project2.id][today]["total"] == 3
        assert response.data[project2.id][yesterday]["reviewed"] == 0
        assert response.data[project2.id][yesterday]["total"] == 1
        assert response.data[project2.id][two_days_ago]["reviewed"] == 0
        assert response.data[project2.id][two_days_ago]["total"] == 0

        self.create_group_history(
            group=group1, date_added=before_now(days=1), status=GroupHistoryStatus.UNRESOLVED
        )
        self.create_group_history(group=group2, status=GroupHistoryStatus.RESOLVED)
        # making sure it doesnt bork anything
        self.create_group_history(group=group2, status=GroupHistoryStatus.ASSIGNED)

        response = self.get_success_response(self.team.organization.slug, self.team.slug)
        assert len(response.data) == 2

        assert response.data[project1.id][today]["reviewed"] == 0
        assert response.data[project1.id][today]["total"] == 0
        assert response.data[project1.id][yesterday]["reviewed"] == 0
        assert response.data[project1.id][yesterday]["total"] == 1
        assert response.data[project1.id][two_days_ago]["reviewed"] == 1
        assert response.data[project1.id][two_days_ago]["reviewed"] == 1

        assert response.data[project2.id][today]["reviewed"] == 4
        assert response.data[project2.id][today]["total"] == 4
        assert response.data[project2.id][yesterday]["reviewed"] == 0
        assert response.data[project2.id][yesterday]["total"] == 1
        assert response.data[project2.id][two_days_ago]["reviewed"] == 0
        assert response.data[project2.id][two_days_ago]["total"] == 0
