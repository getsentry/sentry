from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.models import GroupRelease, GroupStatus, ReleaseProject
from sentry.testutils import TestCase
from sentry.utils.suspect_resolutions_releases.get_suspect_resolutions_releases import (
    get_suspect_resolutions_releases,
)


class GetSuspectResolutionsReleasesTest(TestCase):
    @mock.patch("sentry.analytics.record")
    def test_get_suspect_resolutions_releases(self, record):
        project = self.create_project()
        issue = self.create_group(status=GroupStatus.UNRESOLVED, project=project)
        release1 = self.create_release(date_added=timezone.now() - timedelta(days=1))
        release2 = self.create_release(date_added=timezone.now())

        ReleaseProject.objects.create(project=project, release=release1)
        ReleaseProject.objects.create(project=project, release=release2)
        GroupRelease.objects.create(
            project_id=project.id, group_id=issue.id, release_id=release1.id
        )

        assert get_suspect_resolutions_releases(release2, project) == [issue.id]

        notification_record = [
            r for r in record.call_args_list if r[0][0] == "suspect_resolution_releases.evaluation"
        ]

        assert notification_record == [
            mock.call(
                "suspect_resolution_releases.evaluation",
                algo_version="0.0.1",
                latest_release_id=release1.id,
                current_release_id=release2.id,
                issue_id=issue.id,
                project_id=project.id,
                is_suspect_resolution=True,
            )
        ]
