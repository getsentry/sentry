from __future__ import absolute_import

from django.conf import settings
from django.template import Context, Template

from sentry.models import ProjectKey
from sentry.testutils import TestCase


class DsnTest(TestCase):
    TEMPLATE = Template("{% load sentry_dsn %}{% public_dsn %}")

    def test_valid_dsn(self):
        project = self.create_project()
        with self.settings(SENTRY_PROJECT=project.id):
            key = ProjectKey.objects.get_or_create(project=project)[0]
            result = self.TEMPLATE.render(Context())

            assert key.dsn_public in result
            assert len(result) > 0

    def test_no_system_url(self):
        project = self.create_project()

        new_options = settings.SENTRY_OPTIONS.copy()
        new_options['system.url-prefix'] = ''

        with self.settings(SENTRY_PROJECT=project.id, SENTRY_OPTIONS=new_options):
            result = self.TEMPLATE.render(Context())

            assert not result
            assert len(result) == 0
