from datetime import timedelta

from django.utils.timezone import now
from freezegun import freeze_time

from sentry.models import GroupHistory, GroupHistoryStatus
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


@freeze_time()
class TeamTimeToResolutionTest(APITestCase):
    endpoint = "sentry-api-0-team-time-to-resolution"

    def test_simple(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        group1 = self.create_group(checksum="a" * 32, project=project1, times_seen=10)
        group2 = self.create_group(checksum="b" * 32, project=project2, times_seen=5)

        gh1 = GroupHistory.objects.create(
            group=group1,
            project=project1,
            actor=self.user.actor,
            date_added=before_now(days=5),
            status=GroupHistoryStatus.UNRESOLVED,
            prev_history=None,
            prev_history_date=None,
        )

        GroupHistory.objects.create(
            group=group1,
            project=project1,
            actor=self.user.actor,
            status=GroupHistoryStatus.RESOLVED,
            prev_history=gh1,
            prev_history_date=gh1.date_added,
            date_added=before_now(days=2),
        )

        gh2 = GroupHistory.objects.create(
            group=group2,
            project=project2,
            actor=self.user.actor,
            date_added=before_now(days=10),
            status=GroupHistoryStatus.UNRESOLVED,
            prev_history=None,
            prev_history_date=None,
        )

        GroupHistory.objects.create(
            group=group2,
            project=project2,
            actor=self.user.actor,
            status=GroupHistoryStatus.RESOLVED,
            prev_history=gh2,
            prev_history_date=gh2.date_added,
        )
        today = str(now().replace(hour=0, minute=0, second=0, microsecond=0))
        yesterday = str(
            (now() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        )
        two_days_ago = str(
            (now() - timedelta(days=2)).replace(hour=0, minute=0, second=0, microsecond=0)
        )
        self.login_as(user=self.user)
        response = self.get_success_response(
            self.team.organization.slug, self.team.slug, statsPeriod="14d"
        )
        assert len(response.data) == 14
        assert response.data[today]["avg"] == timedelta(days=10).total_seconds()
        assert response.data[two_days_ago]["avg"] == timedelta(days=3).total_seconds()
        assert response.data[yesterday]["avg"] == 0

        # Lower "todays" average by adding another resolution, but this time 5 days instead of 10 (avg is 7.5 now)
        gh2 = GroupHistory.objects.create(
            group=group2,
            project=project2,
            actor=self.user.actor,
            date_added=before_now(days=5),
            status=GroupHistoryStatus.UNRESOLVED,
            prev_history=None,
            prev_history_date=None,
        )
        GroupHistory.objects.create(
            group=group2,
            project=project2,
            actor=self.user.actor,
            status=GroupHistoryStatus.RESOLVED,
            prev_history=gh2,
            prev_history_date=gh2.date_added,
        )

        # making sure it doesnt bork anything
        GroupHistory.objects.create(
            group=group2,
            project=project2,
            actor=self.user.actor,
            status=GroupHistoryStatus.DELETED,
            prev_history=gh2,
            prev_history_date=gh2.date_added,
        )

        response = self.get_success_response(self.team.organization.slug, self.team.slug)
        assert len(response.data) == 90
        assert response.data[today]["avg"] == timedelta(days=7, hours=12).total_seconds()
        assert response.data[two_days_ago]["avg"] == timedelta(days=3).total_seconds()
        assert response.data[yesterday]["avg"] == 0
