# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import ProjectRedirect
from sentry.testutils import TestCase


class ProjectRedirectTest(TestCase):
    def test_record(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        ProjectRedirect.record(project, "old_slug")

        assert ProjectRedirect.objects.filter(redirect_slug="old_slug", project=project).exists()

        # Recording the same historic slug on a different project updates the
        # project pointer.
        project2 = self.create_project(organization=org)
        ProjectRedirect.record(project2, "old_slug")

        assert not ProjectRedirect.objects.filter(
            redirect_slug="old_slug", project=project
        ).exists()

        assert ProjectRedirect.objects.filter(redirect_slug="old_slug", project=project2).exists()
