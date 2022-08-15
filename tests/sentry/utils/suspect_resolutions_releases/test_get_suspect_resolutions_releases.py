from datetime import timedelta

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
