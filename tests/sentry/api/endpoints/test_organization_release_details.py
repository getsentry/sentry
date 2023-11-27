import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from django.urls import reverse

from sentry.api.endpoints.organization_release_details import OrganizationReleaseSerializer
from sentry.constants import MAX_VERSION_LENGTH
from sentry.locks import locks
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.files.file import File
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.release import Release, ReleaseProject, ReleaseStatus
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releasefile import ReleaseFile
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.repository import Repository
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token

pytestmark = [requires_snuba]


@region_silo_test
class ReleaseDetailsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.user1 = self.create_user(is_staff=False, is_superuser=False)

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        self.team1 = self.create_team(organization=self.organization)
        self.project1 = self.create_project(teams=[self.team1], organization=self.organization)

    def test_simple(self):
        team2 = self.create_team(organization=self.organization)

        project2 = self.create_project(teams=[team2], organization=self.organization)

        release = Release.objects.create(organization_id=self.organization.id, version="abcabcabc")
        release2 = Release.objects.create(organization_id=self.organization.id, version="12345678")
        release.add_project(self.project1)
        release2.add_project(project2)

        environment = Environment.objects.create(organization_id=self.organization.id, name="prod")
        environment.add_project(self.project1)
        environment.add_project(project2)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        ReleaseProjectEnvironment.objects.create(
            project_id=self.project1.id,
            release_id=release.id,
            environment_id=environment.id,
            new_issues_count=5,
        )
        ReleaseProject.objects.filter(project=self.project1, release=release).update(new_groups=5)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release.version},
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["version"] == release.version
        assert response.data["newGroups"] == 5

        # check for current project meta should be empty if project id is not provided
        assert response.data["currentProjectMeta"] == {}

        # no access
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release2.version},
        )
        response = self.client.get(url)
        assert response.status_code == 404

    def test_multiple_projects(self):
        team2 = self.create_team(organization=self.organization)

        project2 = self.create_project(teams=[team2], organization=self.organization)

        release = Release.objects.create(organization_id=self.organization.id, version="abcabcabc")
        release.add_project(self.project1)
        release.add_project(project2)

        self.create_member(
            teams=[self.team1, team2], user=self.user1, organization=self.organization
        )

        self.login_as(user=self.user1)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release.version},
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content

    def test_wrong_project(self):
        project2 = self.create_project(teams=[self.team1], organization=self.organization)

        release = Release.objects.create(organization_id=self.organization.id, version="abcabcabc")
        release.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release.version},
        )

        response = self.client.get(url, {"project": project2.id})
        assert response.status_code == 404

        response = self.client.get(url, {"project": self.project1.id})
        assert response.status_code == 200

    def test_correct_project_contains_current_project_meta(self):
        """
        Test that shows when correct project id is passed to the request, `sessionsLowerBound`,
        `sessionsUpperBound`, `prevReleaseVersion`, `nextReleaseVersion`, `firstReleaseVersion`
        and `lastReleaseVersion` are present in `currentProjectMeta` key
        """
        release = Release.objects.create(organization_id=self.organization.id, version="abcabcabc")
        release.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release.version},
        )

        response = self.client.get(url, {"project": self.project1.id})
        assert response.status_code == 200
        assert "sessionsLowerBound" in response.data["currentProjectMeta"]
        assert "sessionsUpperBound" in response.data["currentProjectMeta"]
        assert "prevReleaseVersion" in response.data["currentProjectMeta"]
        assert "nextReleaseVersion" in response.data["currentProjectMeta"]
        assert "firstReleaseVersion" in response.data["currentProjectMeta"]
        assert "lastReleaseVersion" in response.data["currentProjectMeta"]

    def test_incorrect_sort_option_should_return_invalid_sort_response(self):
        """
        Test that ensures a 400 response is returned when an invalid sort option
        is provided
        """
        release = Release.objects.create(organization_id=self.organization.id, version="abcabcabc")
        release.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release.version},
        )
        response = self.client.get(url, {"project": self.project1.id, "sort": "invalid_sort"})
        assert response.status_code == 400

    def test_get_prev_and_next_release_to_current_release_on_date_sort(self):
        release_1 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@1.0.0"
        )
        release_1.add_project(self.project1)

        release_2 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@2.0.0"
        )
        release_2.add_project(self.project1)

        release_3 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@3.0.0"
        )
        release_3.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_2.version},
        )
        response = self.client.get(url, {"project": self.project1.id})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["nextReleaseVersion"] == "foobar@3.0.0"
        assert response.data["currentProjectMeta"]["prevReleaseVersion"] == "foobar@1.0.0"

        # Test for first release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_3.version},
        )
        response = self.client.get(url, {"project": self.project1.id})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["nextReleaseVersion"] is None
        assert response.data["currentProjectMeta"]["prevReleaseVersion"] == "foobar@2.0.0"

        # Test for last release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_1.version},
        )
        response = self.client.get(url, {"project": self.project1.id})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["nextReleaseVersion"] == "foobar@2.0.0"
        assert response.data["currentProjectMeta"]["prevReleaseVersion"] is None

    def test_get_prev_and_next_release_to_current_release_on_date_sort_with_same_date(self):
        """
        Test that ensures that in the case we are trying to get prev and next release to a current
        release with exact same date then we fallback to id comparison
        """
        date_now = datetime.utcnow()
        release_1 = Release.objects.create(
            date_added=date_now, organization_id=self.organization.id, version="foobar@1.0.0"
        )
        release_1.add_project(self.project1)

        release_2 = Release.objects.create(
            date_added=date_now, organization_id=self.organization.id, version="foobar@2.0.0"
        )
        release_2.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_1.version},
        )
        response = self.client.get(url, {"project": self.project1.id})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["nextReleaseVersion"] == "foobar@2.0.0"
        assert response.data["currentProjectMeta"]["prevReleaseVersion"] is None

        # Test for first release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_2.version},
        )
        response = self.client.get(url, {"project": self.project1.id})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["nextReleaseVersion"] is None
        assert response.data["currentProjectMeta"]["prevReleaseVersion"] == "foobar@1.0.0"

    def test_get_prev_and_next_release_to_current_release_on_date_sort_env_filter_applied(self):
        """
        Test that ensures that environment filter is applied when fetching prev and next
        releases on date sort order
        """
        release_1 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@1.0.0"
        )
        release_1.add_project(self.project1)

        release_2 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@2.0.0"
        )
        release_2.add_project(self.project1)

        release_3 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@3.0.0"
        )
        release_3.add_project(self.project1)

        environment = Environment.objects.create(organization_id=self.organization.id, name="prod")
        environment.add_project(self.project1)

        ReleaseProjectEnvironment.objects.create(
            project_id=self.project1.id,
            release_id=release_3.id,
            environment_id=environment.id,
            new_issues_count=5,
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project1.id,
            release_id=release_1.id,
            environment_id=environment.id,
            new_issues_count=5,
        )

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_3.version},
        )
        response = self.client.get(url, {"project": self.project1.id, "environment": ["prod"]})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["nextReleaseVersion"] is None
        assert response.data["currentProjectMeta"]["prevReleaseVersion"] == "foobar@1.0.0"

    def test_get_prev_and_next_release_to_current_release_on_date_sort_status_filter_applied(self):
        """
        Test that ensures that status filter is applied when fetching prev and next
        releases on date sort order
        """
        release_1 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@1.0.0"
        )
        release_1.add_project(self.project1)

        release_2 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@2.0.0"
        )
        release_2.add_project(self.project1)

        release_3 = Release.objects.create(
            organization_id=self.organization.id,
            version="foobar@3.0.0",
            status=ReleaseStatus.ARCHIVED,
        )
        release_3.add_project(self.project1)

        environment = Environment.objects.create(organization_id=self.organization.id, name="prod")
        environment.add_project(self.project1)

        ReleaseProjectEnvironment.objects.create(
            project_id=self.project1.id,
            release_id=release_3.id,
            environment_id=environment.id,
            new_issues_count=5,
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project1.id,
            release_id=release_1.id,
            environment_id=environment.id,
            new_issues_count=5,
        )

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_3.version},
        )
        response = self.client.get(url, {"project": self.project1.id, "status": "archived"})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["prevReleaseVersion"] is None
        assert response.data["currentProjectMeta"]["nextReleaseVersion"] is None

    def test_get_prev_and_next_release_to_current_release_on_date_sort_query_filter_applied(self):
        """
        Test that ensures that query filter is applied when fetching prev and next
        releases on date sort order
        """
        release_1 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@1.0.0"
        )
        release_1.add_project(self.project1)

        release_2 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@1.0.5"
        )
        release_2.add_project(self.project1)

        release_3 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@3.0.0"
        )
        release_3.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_2.version},
        )
        response = self.client.get(url, {"project": self.project1.id, "query": "foobar@1"})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["prevReleaseVersion"] == "foobar@1.0.0"
        assert response.data["currentProjectMeta"]["nextReleaseVersion"] is None

    def test_get_prev_and_next_release_on_date_sort_does_not_apply_stats_period_filter(self):
        """
        Test that ensures that stats_period filter is applied when fetching prev and next
        releases on date sort order
        """
        release_1 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@1.0.0"
        )
        release_1.add_project(self.project1)

        release_2 = Release.objects.create(
            organization_id=self.organization.id, version="foobar@2.0.0"
        )
        release_2.add_project(self.project1)

        date_added_from_8d = datetime.utcnow() - timedelta(days=8)
        release_3 = Release.objects.create(
            organization_id=self.organization.id,
            version="foobar@3.0.0",
            date_added=date_added_from_8d,
        )
        release_3.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_1.version},
        )
        response = self.client.get(url, {"project": self.project1.id, "summaryStatsPeriod": "24h"})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["nextReleaseVersion"] == "foobar@2.0.0"
        assert response.data["currentProjectMeta"]["prevReleaseVersion"] == "foobar@3.0.0"

    def test_get_first_and_last_release_on_date_sort(self):
        """
        Test that ensures that the first release and the last release in terms of `date_added` are
        retrieved correctly
        """
        release_1 = self.create_release(project=self.project1, version="foobar@1.0.0")
        release_1.add_project(self.project1)

        release_2 = self.create_release(project=self.project1, version="foobar@2.0.0")
        release_2.add_project(self.project1)

        release_3 = self.create_release(project=self.project1, version="foobar@3.0.0")
        release_3.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_1.version},
        )
        response = self.client.get(url, {"project": self.project1.id})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["firstReleaseVersion"] == "foobar@1.0.0"
        assert response.data["currentProjectMeta"]["lastReleaseVersion"] == "foobar@3.0.0"

    def test_get_first_and_last_release_on_date_sort_with_exact_same_date(self):
        """
        Test that ensures that the first release and the last release in terms of `date_added` are
        retrieved correctly in the case when all releases have the same exact datetime and we
        need to fallback to comparison with id
        """
        date_now = datetime.utcnow()
        release_2 = self.create_release(
            project=self.project1, version="foobar@2.0.0", date_added=date_now
        )
        release_2.add_project(self.project1)

        release_1 = self.create_release(
            project=self.project1, version="foobar@1.0.0", date_added=date_now
        )
        release_1.add_project(self.project1)

        release_3 = self.create_release(
            project=self.project1, version="foobar@3.0.0", date_added=date_now
        )
        release_3.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_1.version},
        )
        response = self.client.get(url, {"project": self.project1.id})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["firstReleaseVersion"] == "foobar@2.0.0"
        assert response.data["currentProjectMeta"]["lastReleaseVersion"] == "foobar@3.0.0"

    def test_get_first_and_last_release_on_date_sort_env_filter_applied(self):
        """
        Test that ensures that environment filter is applied when fetching first and last
        releases on date sort order
        """
        release_1 = self.create_release(project=self.project1, version="foobar@1.0.0")
        release_1.add_project(self.project1)

        release_2 = self.create_release(project=self.project1, version="foobar@2.0.0")
        release_2.add_project(self.project1)

        release_3 = self.create_release(project=self.project1, version="foobar@3.0.0")
        release_3.add_project(self.project1)

        release_4 = self.create_release(project=self.project1, version="foobar@4.0.0")
        release_4.add_project(self.project1)

        environment = Environment.objects.create(organization_id=self.organization.id, name="prod")
        environment.add_project(self.project1)

        ReleaseProjectEnvironment.objects.create(
            project_id=self.project1.id,
            release_id=release_2.id,
            environment_id=environment.id,
            new_issues_count=5,
        )
        ReleaseProjectEnvironment.objects.create(
            project_id=self.project1.id,
            release_id=release_3.id,
            environment_id=environment.id,
            new_issues_count=5,
        )

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_3.version},
        )
        response = self.client.get(url, {"project": self.project1.id, "environment": ["prod"]})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["firstReleaseVersion"] == "foobar@2.0.0"
        assert response.data["currentProjectMeta"]["lastReleaseVersion"] == "foobar@3.0.0"

    def test_get_first_and_last_release_on_non_date_sort(self):
        """
        Test that ensures that when trying to fetch first and last releases on a sort option that
        is not `date`, then the values of `firstReleaseVersion` and `lastReleaseVersion` are None
        values
        """
        release_1 = self.create_release(project=self.project1, version="foobar@1.0.0")
        release_1.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release_1.version},
        )
        response = self.client.get(url, {"project": self.project1.id, "sort": "sessions"})
        assert response.status_code == 400
        assert response.data["detail"] == "invalid sort"

    def test_get_first_and_last_release_when_project_has_no_releases(self):
        """
        Test that ensures that when fetching first and last releases on date sort option in a
        project that contains no matching release for all the filters, then `firstReleaseVersion`
        and `lastReleaseVersion` are None values
        """
        release = self.create_release(project=self.project1, version="foobar@2.0.0")
        release.add_project(self.project1)

        environment = Environment.objects.create(organization_id=self.organization.id, name="test")
        environment.add_project(self.project1)

        self.create_member(teams=[self.team1], user=self.user1, organization=self.organization)

        self.login_as(user=self.user1)

        # Test for middle release of the list
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release.version},
        )
        response = self.client.get(url, {"project": self.project1.id, "environment": ["test"]})
        assert response.status_code == 200
        assert response.data["currentProjectMeta"]["firstReleaseVersion"] is None
        assert response.data["currentProjectMeta"]["lastReleaseVersion"] is None

    def test_with_adoption_stages(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.save()
        team1 = self.create_team(organization=org)
        project1 = self.create_project(teams=[team1], organization=org)
        self.create_member(teams=[team1], user=user, organization=org)
        self.login_as(user=user)
        release1 = Release.objects.create(
            organization_id=org.id, version="1", date_added=datetime(2013, 8, 13, 3, 8, 24, 880386)
        )
        release1.add_project(project1)
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": self.organization.slug, "version": release1.version},
        )

        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        # Not returned because we don't have `adoptionStages=1`.
        assert "adoptionStages" not in response.data
        response = self.client.get(f"{url}?adoptionStages=1", format="json")

        assert response.status_code == 200, response.content
        assert "adoptionStages" in response.data


@region_silo_test
class UpdateReleaseDetailsTest(APITestCase):
    @patch("sentry.tasks.commits.fetch_commits")
    def test_simple(self, mock_fetch_commits):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        repo = Repository.objects.create(
            organization_id=org.id, name="example/example", provider="dummy"
        )
        repo2 = Repository.objects.create(
            organization_id=org.id, name="example/example2", provider="dummy"
        )

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        base_release = Release.objects.create(organization_id=org.id, version="000000000")
        base_release.add_project(project)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release2 = Release.objects.create(organization_id=org.id, version="12345678")
        release.add_project(project)
        release2.add_project(project2)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": base_release.version},
        )
        self.client.put(
            url,
            {
                "ref": "master",
                "headCommits": [
                    {"currentId": "0" * 40, "repository": repo.name},
                    {"currentId": "0" * 40, "repository": repo2.name},
                ],
            },
        )

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            {
                "ref": "master",
                "refs": [
                    {"commit": "a" * 40, "repository": repo.name},
                    {"commit": "b" * 40, "repository": repo2.name},
                ],
            },
        )

        mock_fetch_commits.apply_async.assert_called_with(
            kwargs={
                "release_id": release.id,
                "user_id": user.id,
                "refs": [
                    {"commit": "a" * 40, "repository": repo.name},
                    {"commit": "b" * 40, "repository": repo2.name},
                ],
                "prev_release_id": base_release.id,
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["version"] == release.version

        release = Release.objects.get(id=release.id)
        assert release.ref == "master"

        # no access
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release2.version},
        )
        response = self.client.put(url, {"ref": "master"})
        assert response.status_code == 404

    @patch("sentry.tasks.commits.fetch_commits")
    def test_deprecated_head_commits(self, mock_fetch_commits):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        repo = Repository.objects.create(
            organization_id=org.id, name="example/example", provider="dummy"
        )
        repo2 = Repository.objects.create(
            organization_id=org.id, name="example/example2", provider="dummy"
        )

        team1 = self.create_team(organization=org)
        team2 = self.create_team(organization=org)

        project = self.create_project(teams=[team1], organization=org)
        project2 = self.create_project(teams=[team2], organization=org)

        base_release = Release.objects.create(organization_id=org.id, version="000000000")
        base_release.add_project(project)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release2 = Release.objects.create(organization_id=org.id, version="12345678")
        release.add_project(project)
        release2.add_project(project2)

        self.create_member(teams=[team1], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": base_release.version},
        )
        self.client.put(
            url,
            {
                "ref": "master",
                "headCommits": [
                    {"currentId": "0" * 40, "repository": repo.name},
                    {"currentId": "0" * 40, "repository": repo2.name},
                ],
            },
        )

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            {
                "ref": "master",
                "headCommits": [
                    {"currentId": "a" * 40, "repository": repo.name},
                    {"currentId": "b" * 40, "repository": repo2.name},
                ],
            },
        )

        mock_fetch_commits.apply_async.assert_called_with(
            kwargs={
                "release_id": release.id,
                "user_id": user.id,
                "refs": [
                    {"commit": "a" * 40, "previousCommit": None, "repository": repo.name},
                    {"commit": "b" * 40, "previousCommit": None, "repository": repo2.name},
                ],
                "prev_release_id": base_release.id,
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["version"] == release.version

        release = Release.objects.get(id=release.id)
        assert release.ref == "master"

        # no access
        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release2.version},
        )
        response = self.client.put(url, {"ref": "master"})
        assert response.status_code == 404

    def test_commits(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], organization=org)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release.add_project(project)
        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(url, data={"commits": [{"id": "a" * 40}, {"id": "b" * 40}]})

        assert response.status_code == 200, (response.status_code, response.content)

        rc_list = list(
            ReleaseCommit.objects.filter(release=release)
            .select_related("commit", "commit__author")
            .order_by("order")
        )
        assert len(rc_list) == 2
        for rc in rc_list:
            assert rc.organization_id == org.id

    def test_commits_patchset_character_limit_255(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], organization=org)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release.add_project(project)
        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            data={
                "commits": [
                    {
                        "id": "a" * 40,
                        "patch_set": [{"path": "/a/really/long/path/" + ("z" * 255), "type": "A"}],
                    }
                ]
            },
        )

        assert response.status_code == 200, (response.status_code, response.content)

        rc_list = list(
            ReleaseCommit.objects.filter(release=release)
            .select_related("commit", "commit__author")
            .order_by("order")
        )
        assert len(rc_list) == 1
        for rc in rc_list:
            assert rc.organization_id == org.id

    def test_commits_patchset_character_limit_reached(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(teams=[team], organization=org)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release.add_project(project)
        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            data={
                "commits": [
                    {
                        "id": "a" * 40,
                        "patch_set": [{"path": "z" * (255 * 2 + 1), "type": "A"}],
                    }
                ]
            },
        )

        assert response.status_code == 400, (response.status_code, response.content)

    def test_commits_lock_conflict(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        release = self.create_release(project, self.user, version="1.2.1")
        release.add_project(project)

        # Simulate a concurrent request by using an existing release
        # that has its commit lock taken out.
        lock = locks.get(Release.get_lock_key(org.id, release.id), duration=10, name="release")
        lock.acquire()

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(url, data={"commits": [{"id": "a" * 40}, {"id": "b" * 40}]})
        assert response.status_code == 409, (response.status_code, response.content)
        assert "Release commits" in response.data["detail"]

    def test_release_archiving(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(url, data={"status": "archived"})

        assert response.status_code == 200, (response.status_code, response.content)

        assert Release.objects.get(id=release.id).status == ReleaseStatus.ARCHIVED

    def test_activity_generation(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(url, data={"dateReleased": datetime.utcnow().isoformat() + "Z"})

        assert response.status_code == 200, (response.status_code, response.content)

        release = Release.objects.get(id=release.id)
        assert release.date_released

        activity = Activity.objects.filter(
            type=ActivityType.RELEASE.value, project=project, ident=release.version
        )
        assert activity.exists()

    def test_activity_generation_long_release(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        release = Release.objects.create(organization_id=org.id, version="x" * 65)

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(url, data={"dateReleased": datetime.utcnow().isoformat() + "Z"})

        assert response.status_code == 200, (response.status_code, response.content)

        release = Release.objects.get(id=release.id)
        assert release.date_released

        activity = Activity.objects.filter(
            type=ActivityType.RELEASE.value, project=project, ident=release.version[:64]
        )
        assert activity.exists()

    def test_org_auth_token(self):
        org = self.organization

        with assume_test_silo_mode(SiloMode.CONTROL):
            good_token_str = generate_token(org.slug, "")
            OrgAuthToken.objects.create(
                organization_id=org.id,
                name="token 1",
                token_hashed=hash_token(good_token_str),
                token_last_characters="ABCD",
                scope_list=["org:ci"],
                date_last_used=None,
            )

        repo = Repository.objects.create(
            organization_id=org.id, name="example/example", provider="dummy"
        )

        team1 = self.create_team(organization=org)

        project = self.create_project(teams=[team1], organization=org)

        base_release = Release.objects.create(organization_id=org.id, version="000000000")
        base_release.add_project(project)
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")
        release.add_project(project)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": base_release.version},
        )
        self.client.put(
            url,
            data={
                "ref": "master",
                "headCommits": [
                    {"currentId": "0" * 40, "repository": repo.name},
                ],
            },
            HTTP_AUTHORIZATION=f"Bearer {good_token_str}",
        )

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            data={
                "ref": "master",
                "refs": [
                    {"commit": "a" * 40, "repository": repo.name},
                ],
            },
            HTTP_AUTHORIZATION=f"Bearer {good_token_str}",
        )

        assert response.status_code == 200, response.content
        assert response.data["version"] == release.version

        release = Release.objects.get(id=release.id)
        assert release.ref == "master"


@region_silo_test
class ReleaseDeleteTest(APITestCase):
    def test_simple(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)
        release_file = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not Release.objects.filter(id=release.id).exists()
        assert not ReleaseFile.objects.filter(id=release_file.id).exists()

    def test_existing_group(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.organization
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)

        project = self.create_project(teams=[team], organization=org)

        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)
        self.create_group(first_release=release)

        self.create_member(teams=[team], user=user, organization=org)

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.delete(url)

        assert response.status_code == 400, response.content

        assert Release.objects.filter(id=release.id).exists()

    def test_bad_repo_name(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            data={
                "version": "1.2.1",
                "projects": [project.slug],
                "refs": [{"repository": "not_a_repo", "commit": "a" * 40}],
            },
        )
        assert response.status_code == 400
        assert response.data == {"refs": ["Invalid repository names: not_a_repo"]}

    def test_bad_commit_list(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        org = self.create_organization()
        org.flags.allow_joinleave = False
        org.save()

        team = self.create_team(organization=org)
        project = self.create_project(name="foo", organization=org, teams=[team])
        Repository.objects.create(organization_id=org.id, name="a_repo")
        release = Release.objects.create(organization_id=org.id, version="abcabcabc")

        release.add_project(project)

        self.create_member(teams=[team], user=user, organization=org)
        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-organization-release-details",
            kwargs={"organization_slug": org.slug, "version": release.version},
        )
        response = self.client.put(
            url,
            data={
                "version": "1.2.1",
                "projects": [project.slug],
                "commits": [{"repository": "a_repo"}],
            },
        )
        assert response.status_code == 400
        assert response.json() == {"commits": {"id": ["This field is required."]}}


@region_silo_test
class ReleaseSerializerTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.repo_name = "repo/name"
        self.repo2_name = "repo2/name"
        self.commits = [{"id": "a" * 40}, {"id": "b" * 40}]
        self.ref = "master"
        self.url = "https://example.com"
        self.dateReleased = "1000-10-10T06:06"
        self.headCommits = [
            {"currentId": "0" * 40, "repository": self.repo_name},
            {"currentId": "0" * 40, "repository": self.repo2_name},
        ]
        self.refs = [
            {"commit": "a" * 40, "previousCommit": "", "repository": self.repo_name},
            {"commit": "b" * 40, "previousCommit": "", "repository": self.repo2_name},
        ]

    def test_simple(self):
        serializer = OrganizationReleaseSerializer(
            data={
                "ref": self.ref,
                "url": self.url,
                "dateReleased": self.dateReleased,
                "commits": self.commits,
                "headCommits": self.headCommits,
                "refs": self.refs,
            }
        )

        assert serializer.is_valid()
        assert set(serializer.fields.keys()) == {
            "ref",
            "url",
            "dateReleased",
            "commits",
            "headCommits",
            "refs",
            "status",
        }

        result = serializer.validated_data
        assert result["ref"] == self.ref
        assert result["url"] == self.url
        assert result["dateReleased"] == datetime(1000, 10, 10, 6, 6, tzinfo=timezone.utc)
        assert result["commits"] == self.commits
        assert result["headCommits"] == self.headCommits
        assert result["refs"] == self.refs

    def test_fields_not_required(self):
        serializer = OrganizationReleaseSerializer(data={})
        assert serializer.is_valid()

    def test_do_not_allow_null_commits(self):
        serializer = OrganizationReleaseSerializer(data={"commits": None})
        assert not serializer.is_valid()

    def test_do_not_allow_null_head_commits(self):
        serializer = OrganizationReleaseSerializer(data={"headCommits": None})
        assert not serializer.is_valid()

    def test_do_not_allow_null_refs(self):
        serializer = OrganizationReleaseSerializer(data={"refs": None})
        assert not serializer.is_valid()

    def test_ref_limited_by_max_version_length(self):
        serializer = OrganizationReleaseSerializer(data={"ref": "a" * MAX_VERSION_LENGTH})
        assert serializer.is_valid()
        serializer = OrganizationReleaseSerializer(data={"ref": "a" * (MAX_VERSION_LENGTH + 1)})
        assert not serializer.is_valid()

    def test_author_email_patch(self):
        serializer = OrganizationReleaseSerializer(
            data={"commits": [{"id": "a", "author_email": "email[test]@example.org"}]}
        )
        assert serializer.is_valid()
