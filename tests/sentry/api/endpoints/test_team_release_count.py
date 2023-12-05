from sentry.models.release import Release
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TeamReleaseCountTest(APITestCase):
    endpoint = "sentry-api-0-team-release-count"

    def test_simple(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org2 = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org2)
        project3 = self.create_project(teams=[team1], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)
        release1 = Release.objects.create(
            organization_id=org.id, version="1", date_added=before_now(days=15)
        )
        release1.add_project(project1)

        release2 = Release.objects.create(
            organization_id=org2.id, version="2", date_added=before_now(days=12)
        )  # This release isn't returned, its in another org
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version="3",
            date_added=before_now(days=10),
            date_released=before_now(days=10),
        )
        release3.add_project(project1)

        release4 = Release.objects.create(
            organization_id=org.id, version="4", date_added=before_now(days=5)
        )
        release4.add_project(project3)
        release5 = Release.objects.create(
            organization_id=org.id, version="5", date_added=before_now(days=5)
        )
        release5.add_project(project3)
        response = self.get_success_response(org.slug, team1.slug)

        assert len(response.data) == 3
        assert len(response.data["release_counts"]) == 90
        assert len(response.data["project_avgs"]) == 2
        assert len(response.data["last_week_totals"]) == 1
        assert response.data["last_week_totals"][project3.id] == 2

        assert response.data["release_counts"][str(before_now(days=0).date())] == 0
        assert response.data["release_counts"][str(before_now(days=5).date())] == 2
        assert response.data["release_counts"][str(before_now(days=10).date())] == 1
        assert response.data["release_counts"][str(before_now(days=15).date())] == 1

        release4.add_project(project1)  # up the last week total for project1 by 1

        response = self.get_success_response(org.slug, team1.slug)
        assert len(response.data) == 3
        assert len(response.data["release_counts"]) == 90
        assert len(response.data["project_avgs"]) == 2
        assert len(response.data["last_week_totals"]) == 2
        assert response.data["last_week_totals"][project1.id] == 1
        assert response.data["last_week_totals"][project3.id] == 2

    def test_projects_only_for_current_team(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        # Project 2 does not belong to the current team, but shares a release
        project2 = self.create_project(teams=[team2], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)
        release1 = Release.objects.create(
            organization_id=org.id, version="1", date_added=before_now(days=15)
        )
        release1.add_project(project1)
        release1.add_project(project2)

        response = self.get_success_response(org.slug, team1.slug)

        assert project2.id not in response.data["project_avgs"]

    def test_multi_project_release(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org2 = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project1 = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org2)
        project3 = self.create_project(teams=[team1], organization=org)

        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)
        release1 = Release.objects.create(
            organization_id=org.id, version="1", date_added=before_now(days=15)
        )
        release1.add_project(project1)
        release1.add_project(project3)

        release2 = Release.objects.create(
            organization_id=org2.id, version="2", date_added=before_now(days=12)
        )  # This release isn't returned, its in another org
        release2.add_project(project2)

        release3 = Release.objects.create(
            organization_id=org.id,
            version="3",
            date_added=before_now(days=10),
            date_released=before_now(days=10),
        )
        release3.add_project(project1)

        release4 = Release.objects.create(
            organization_id=org.id, version="4", date_added=before_now(days=5)
        )
        release4.add_project(project3)
        release5 = Release.objects.create(
            organization_id=org.id, version="5", date_added=before_now(days=5)
        )
        release5.add_project(project3)
        response = self.get_success_response(org.slug, team1.slug)

        assert len(response.data) == 3
        assert len(response.data["release_counts"]) == 90
        assert len(response.data["project_avgs"]) == 2
        assert len(response.data["last_week_totals"]) == 1

        assert response.data["release_counts"][str(before_now(days=0).date())] == 0
        assert response.data["release_counts"][str(before_now(days=5).date())] == 2
        assert response.data["release_counts"][str(before_now(days=10).date())] == 1
        assert response.data["release_counts"][str(before_now(days=15).date())] == 1
