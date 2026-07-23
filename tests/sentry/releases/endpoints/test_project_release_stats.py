from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone

from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject
from sentry.releases.endpoints.project_release_stats import upsert_missing_release
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba, pytest.mark.sentry_metrics]


class ProjectReleaseStatsTest(APITestCase):
    def test_simple(self) -> None:
        """Minimal test to ensure code coverage of the endpoint"""
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        release = Release.objects.create(
            organization_id=project.organization_id,
            version="1",
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386, tzinfo=UTC),
        )
        release.add_project(project)

        url = reverse(
            "sentry-api-0-project-release-stats",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
                "version": "1",
            },
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content

    def test_simple_no_release(self) -> None:
        """Minimal test to ensure code coverage of the endpoint"""
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-release-stats",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
                "version": "1",
            },
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content


class UpsertMissingReleaseTest(TestCase):
    def upsert_with_health_data(self, project, version="1.0"):
        with patch(
            "sentry.releases.endpoints.project_release_stats.release_health"
        ) as mock_release_health:
            mock_release_health.backend.get_oldest_health_data_for_releases.return_value = {
                (project.id, version): timezone.now()
            }
            return upsert_missing_release(project, version)

    def test_creates_release_from_health_data(self) -> None:
        project = self.create_project()

        date_added = self.upsert_with_health_data(project)

        release = Release.objects.get(organization_id=project.organization_id, version="1.0")
        assert date_added == release.date_added
        assert ReleaseProject.objects.filter(release=release, project=project).exists()

    def test_auto_creation_disabled_returns_none(self) -> None:
        project = self.create_project()
        project.update_option("sentry:enable_auto_release_creation", False)

        with self.feature("organizations:auto-release-creation"):
            assert self.upsert_with_health_data(project) is None

        assert not Release.objects.filter(organization_id=project.organization_id).exists()

    def test_auto_creation_disabled_associates_existing_release(self) -> None:
        # A release created out-of-band (e.g. via the CLI) is still associated even
        # when auto-creation is disabled.
        project = self.create_project()
        project.update_option("sentry:enable_auto_release_creation", False)
        release = Release.objects.create(organization_id=project.organization_id, version="1.0")

        with self.feature("organizations:auto-release-creation"):
            date_added = self.upsert_with_health_data(project)

        assert date_added == release.date_added
        assert ReleaseProject.objects.filter(release=release, project=project).exists()
