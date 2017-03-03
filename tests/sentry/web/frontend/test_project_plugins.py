from __future__ import absolute_import

from exam import fixture

from django.core.urlresolvers import reverse

from sentry.models import ProjectOption
from sentry.testutils import TestCase


class ManageProjectPluginsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-manage-project-plugins', args=[
            self.organization.slug, self.project.slug])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_renders_with_required_context(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/projects/plugins/manage.html')

    def test_saves_settings(self):
        self.login_as(self.user)

        resp = self.client.post(self.path, {
            'plugin': ['os', 'urls'],
        })
        assert resp.status_code == 302

        opts = dict(
            (p.key, p.value)
            for p in ProjectOption.objects.filter(
                project=self.project,
                key__in=[
                    'auto_tag:_operating_systems:enabled', 'auto_tag:_urls:enabled',
                    'mail:enabled',
                ],
            ),
        )
        assert opts.get('auto_tag:_operating_systems:enabled') is True
        assert opts.get('auto_tag:_urls:enabled') is True
        assert opts.get('mail:enabled') is False
