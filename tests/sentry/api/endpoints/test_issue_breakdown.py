from datetime import timedelta

from django.utils.timezone import now
from freezegun import freeze_time

from sentry.models import GroupHistory, GroupHistoryStatus
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now


@freeze_time()
class TeamIssueBreakdownTest(APITestCase):
    endpoint = "sentry-api-0-team-issue-breakdown"

    def test_simple(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        group1 = self.create_group(checksum="a" * 32, project=project1, times_seen=10)
        group2 = self.create_group(checksum="b" * 32, project=project2, times_seen=5)

        GroupHistory.objects.create(
            organization=self.organization,
            group=group1,
            project=project1,
            actor=self.user.actor,
            date_added=before_now(days=5),
            status=GroupHistoryStatus.UNRESOLVED,
        )
        GroupHistory.objects.create(
            organization=self.organization,
            group=group1,
            project=project1,
            actor=self.user.actor,
            status=GroupHistoryStatus.RESOLVED,
            date_added=before_now(days=2),
        )
        GroupHistory.objects.create(
            organization=self.organization,
            group=group1,
            project=project1,
            actor=self.user.actor,
            status=GroupHistoryStatus.REGRESSED,
            date_added=before_now(days=2),
        )
        GroupHistory.objects.create(
            organization=self.organization,
            group=group2,
            project=project2,
            actor=self.user.actor,
            date_added=before_now(days=10),
            status=GroupHistoryStatus.UNRESOLVED,
        )
        GroupHistory.objects.create(
            organization=self.organization,
            group=group2,
            project=project2,
            actor=self.user.actor,
            date_added=before_now(days=1),
            status=GroupHistoryStatus.UNRESOLVED,
        )

        GroupHistory.objects.create(
            organization=self.organization,
            group=group2,
            project=project2,
            actor=self.user.actor,
            status=GroupHistoryStatus.RESOLVED,
        )
        GroupHistory.objects.create(
            organization=self.organization,
            group=group2,
            project=project2,
            actor=self.user.actor,
            status=GroupHistoryStatus.RESOLVED,
        )
        GroupHistory.objects.create(
            organization=self.organization,
            group=group2,
            project=project2,
            actor=self.user.actor,
            status=GroupHistoryStatus.IGNORED,
        )
        today = str(now().date())
        yesterday = str((now() - timedelta(days=1)).date())
        two_days_ago = str((now() - timedelta(days=2)).date())
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

        GroupHistory.objects.create(
            organization=self.organization,
            group=group1,
            project=project1,
            actor=self.user.actor,
            date_added=before_now(days=1),
            status=GroupHistoryStatus.UNRESOLVED,
        )
        GroupHistory.objects.create(
            organization=self.organization,
            group=group2,
            project=project2,
            actor=self.user.actor,
            status=GroupHistoryStatus.RESOLVED,
        )

        # making sure it doesnt bork anything
        GroupHistory.objects.create(
            organization=self.organization,
            group=group2,
            project=project2,
            actor=self.user.actor,
            status=GroupHistoryStatus.ASSIGNED,
        )

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
