from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.models import GroupStatus
from sentry.testutils import TestCase
from sentry.utils.suspect_resolutions_releases.get_suspect_resolutions_releases import (
    get_suspect_resolutions_releases,
)


class GetSuspectResolutionsReleasesTest(TestCase):
    def test_get_suspect_resolutions_releases(self):
        project = self.create_project()
        issue = self.create_group(
            status=GroupStatus.UNRESOLVED,
            project=project,
            last_seen=timezone.now() - timedelta(days=2),
        )
        release = self.create_release(date_released=timezone.now())

        assert get_suspect_resolutions_releases(release, project) == [issue.id]

    @mock.patch("sentry.analytics.record")
    def test_suspect_resolutions_releases_evaluation_analytics_event(self, record):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        group1 = self.create_group(project=project, last_seen=timezone.now() - timedelta(days=2))
        release = self.create_release(date_released=timezone.now())
        get_suspect_resolutions_releases(release, project)

        notification_record = [
            r for r in record.call_args_list if r[0][0] == "suspect_resolution_releases.evaluation"
        ]

        assert notification_record == [
            mock.call(
                "suspect_resolution_releases.evaluation",
                algo_version="0.0.1",
                release_id=release.id,
                issue_id=group1.id,
                project_id=project.id,
                is_suspect_resolution=True,
            )
        ]
