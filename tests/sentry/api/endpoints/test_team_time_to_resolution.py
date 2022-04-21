from datetime import timedelta

from django.utils.timezone import now
from freezegun import freeze_time

from sentry.models import GroupAssignee, GroupEnvironment, GroupHistoryStatus
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


@freeze_time()
class TeamTimeToResolutionTest(APITestCase):
    endpoint = "sentry-api-0-team-time-to-resolution"

    def test_simple(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        group1 = self.create_group(checksum="a" * 32, project=project1, times_seen=10)
        group2 = self.create_group(
            checksum="b" * 32, project=project2, times_seen=5, first_seen=before_now(days=20)
        )
        GroupAssignee.objects.assign(group1, self.user)
        GroupAssignee.objects.assign(group2, self.user)

        gh1 = self.create_group_history(
            group1,
            GroupHistoryStatus.UNRESOLVED,
            actor=self.user.actor,
            date_added=before_now(days=5),
        )

        self.create_group_history(
            group1,
            GroupHistoryStatus.RESOLVED,
            actor=self.user.actor,
            prev_history=gh1,
            date_added=before_now(days=2),
        )

        gh2 = self.create_group_history(
            group2,
            GroupHistoryStatus.UNRESOLVED,
            actor=self.user.actor,
            date_added=before_now(days=10),
        )

        self.create_group_history(
            group2,
            GroupHistoryStatus.RESOLVED,
            actor=self.user.actor,
            prev_history=gh2,
        )
        today = str(now().date())
        yesterday = str((now() - timedelta(days=1)).date())
        two_days_ago = str((now() - timedelta(days=2)).date())
        self.login_as(user=self.user)
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="14d"
        )
        assert len(response.data) == 14
        assert response.data[today]["avg"] == timedelta(days=10).total_seconds()
        assert response.data[two_days_ago]["avg"] == timedelta(days=3).total_seconds()
        assert response.data[yesterday]["avg"] == 0

        # Lower "todays" average by adding another resolution, but this time 5 days instead of 10 (avg is 7.5 now)
        gh2 = self.create_group_history(
            group2,
            GroupHistoryStatus.UNRESOLVED,
            actor=self.user.actor,
            date_added=before_now(days=5),
        )
        self.create_group_history(
            group2,
            GroupHistoryStatus.RESOLVED,
            actor=self.user.actor,
            prev_history=gh2,
        )

        # making sure it doesnt bork anything
        self.create_group_history(
            group2,
            GroupHistoryStatus.DELETED,
            actor=self.user.actor,
            prev_history=gh2,
        )
        # Make sure that if we have a `GroupHistory` row with no prev history then we don't crash.
        self.create_group_history(
            group2,
            GroupHistoryStatus.RESOLVED,
            actor=self.user.actor,
        )

        response = self.get_success_response(self.team.organization.slug, self.team.slug)
        assert len(response.data) == 90
        assert response.data[today]["avg"] == timedelta(days=11, hours=16).total_seconds()
        assert response.data[two_days_ago]["avg"] == timedelta(days=3).total_seconds()
        assert response.data[yesterday]["avg"] == 0

    def test_filter_by_environment(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        group1 = self.create_group(checksum="a" * 32, project=project1, times_seen=10)
        env1 = self.create_environment(project=project1, name="prod")
        self.create_environment(project=project1, name="dev")
        GroupAssignee.objects.assign(group1, self.user)
        GroupEnvironment.objects.create(group_id=group1.id, environment_id=env1.id)

        gh1 = self.create_group_history(
            group1,
            GroupHistoryStatus.UNRESOLVED,
            actor=self.user.actor,
            date_added=before_now(days=5),
        )

        self.create_group_history(
            group1,
            GroupHistoryStatus.RESOLVED,
            actor=self.user.actor,
            prev_history=gh1,
            date_added=before_now(days=2),
        )

        today = str(now().date())
        yesterday = str((now() - timedelta(days=1)).date())
        two_days_ago = str((now() - timedelta(days=2)).date())
        self.login_as(user=self.user)
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="14d", environment="prod"
        )
        assert len(response.data) == 14
        assert response.data[today]["avg"] == 0
        assert response.data[two_days_ago]["avg"] == timedelta(days=3).total_seconds()
        assert response.data[yesterday]["avg"] == 0

        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, environment="dev"
        )
        assert len(response.data) == 90
        assert response.data[today]["avg"] == 0
        assert response.data[two_days_ago]["avg"] == 0
        assert response.data[yesterday]["avg"] == 0
