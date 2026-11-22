from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.models.projectplatform import ProjectPlatform
from sentry.tasks.collect_project_platforms import collect_project_platforms
from sentry.testutils.cases import TestCase


class CollectProjectPlatformsTest(TestCase):
    def test_simple(self) -> None:
        now = timezone.now()
        organization = self.create_organization(name="foo")
        project1 = self.create_project(organization=organization, name="foo", slug="foo")
        project2 = self.create_project(organization=organization, name="bar", slug="bar")
        self.create_group(project=project1, last_seen=now, platform="php")
        self.create_group(project=project1, last_seen=now, platform="perl")
        self.create_group(project=project2, last_seen=now, platform="python")

        with self.tasks():
            collect_project_platforms(1)

        assert ProjectPlatform.objects.filter(project_id=project1.id, platform="php").exists()
        assert ProjectPlatform.objects.filter(project_id=project1.id, platform="perl").exists()
        assert ProjectPlatform.objects.filter(project_id=project2.id, platform="python").exists()

    def test_deletes_stale_platforms_in_batches(self) -> None:
        now = timezone.now()
        project = self.create_project()
        for platform in ("php", "perl", "ruby"):
            ProjectPlatform.objects.create(
                project_id=project.id, platform=platform, last_seen=now - timedelta(days=91)
            )
        ProjectPlatform.objects.create(
            project_id=project.id, platform="python", last_seen=now - timedelta(days=89)
        )

        with (
            patch("sentry.tasks.collect_project_platforms.STALE_PLATFORM_DELETE_BATCH_SIZE", 2),
            self.tasks(),
        ):
            collect_project_platforms(1)

        assert list(
            ProjectPlatform.objects.filter(project_id=project.id).values_list("platform", flat=True)
        ) == ["python"]
