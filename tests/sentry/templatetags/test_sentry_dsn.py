from __future__ import absolute_import

from django.conf import settings
from django.template import Context, Template

from sentry.models import ProjectKey
from sentry.testutils import TestCase


class DsnTest(TestCase):
    TEMPLATE = Template("{% load sentry_dsn %}{% public_dsn %}")

    def test_valid_dsn(self):
        self.key = ProjectKey.objects.get_or_create(id=1)[0]
        result = self.TEMPLATE.render(Context())

        assert self.key.dsn_public in result

    def test_no_system_url(self):
        self.key = ProjectKey.objects.get_or_create(id=1)[0]

        new_options = settings.SENTRY_OPTIONS.copy()
        new_options['system.url-prefix'] = ''
        with self.settings(SENTRY_OPTIONS=new_options):
            result = self.TEMPLATE.render(Context())
            assert self.key.dsn_public not in result
            assert result == ''
