from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.models.group import GroupStatus
from sentry.models.grouprelease import GroupRelease
from sentry.models.release import ReleaseProject
from sentry.signals import release_created
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.suspect_resolutions_releases.get_suspect_resolutions_releases import (
    get_suspect_resolutions_releases,
)


@region_silo_test
class GetSuspectResolutionsReleasesTest(TestCase):
    @mock.patch("sentry.analytics.record")
    def test_get_suspect_resolutions_releases(self, record):
        project = self.create_project(id=20)
        issue = self.create_group(
            status=GroupStatus.UNRESOLVED,
            project=project,
            last_seen=timezone.now() - timedelta(days=1),
        )
        previous_release = self.create_release(date_added=timezone.now() - timedelta(days=1))
        current_release = self.create_release(date_added=timezone.now())

        rp1 = ReleaseProject.objects.create(project_id=project.id, release_id=previous_release.id)
        ReleaseProject.objects.create(project_id=project.id, release_id=current_release.id)
        GroupRelease.objects.create(
            project_id=project.id, group_id=issue.id, release_id=previous_release.id
        )

        assert get_suspect_resolutions_releases(current_release) == [issue.id]

        notification_record = [
            r for r in record.call_args_list if r[0][0] == "suspect_resolution_releases.evaluation"
        ]

        assert notification_record == [
            mock.call(
                "suspect_resolution_releases.evaluation",
                algo_version="0.0.1",
                current_release_id=current_release.id,
                issue_id=issue.id,
                is_suspect_resolution=True,
                latest_release_id=rp1.release_id,
            )
        ]

    @mock.patch(
        "sentry.utils.suspect_resolutions_releases.get_suspect_resolutions_releases.get_suspect_resolutions_releases"
    )
    def test_record_suspect_resolutions_releases(self, mock_record_suspect_resolutions_releases):
        release = self.create_release(date_added=timezone.now())

        with self.feature("projects:suspect-resolutions"):
            release_created.send(release=release, sender=self.__class__)

        assert len(mock_record_suspect_resolutions_releases.mock_calls) == 1
