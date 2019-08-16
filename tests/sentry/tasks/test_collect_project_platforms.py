from __future__ import absolute_import, print_function

from django.utils import timezone

from sentry.models import ProjectPlatform
from sentry.testutils import TestCase
from sentry.tasks.collect_project_platforms import collect_project_platforms


class CollectProjectPlatformsTest(TestCase):
    def test_simple(self):
        now = timezone.now()
        organization = self.create_organization(name="foo")
        project1 = self.create_project(organization=organization, name="foo", slug="foo")
        project2 = self.create_project(organization=organization, name="bar", slug="bar")
        self.create_group(project=project1, last_seen=now, platform="php")
        self.create_group(project=project1, last_seen=now, platform="perl")
        self.create_group(project=project2, last_seen=now, platform="python")

        with self.tasks():
            collect_project_platforms()

        assert ProjectPlatform.objects.filter(project_id=project1.id, platform="php").exists()
        assert ProjectPlatform.objects.filter(project_id=project1.id, platform="perl").exists()
        assert ProjectPlatform.objects.filter(project_id=project2.id, platform="python").exists()
