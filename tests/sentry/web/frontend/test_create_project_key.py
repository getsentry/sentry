from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import ProjectKey
from sentry.testutils import TestCase


class NewProjectKeyTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-new-project-key', args=[self.organization.slug, self.project.slug])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_generates_new_key_and_redirects(self):
        keycount = ProjectKey.objects.filter(project=self.project).count()
        self.login_as(self.user)

        resp = self.client.post(self.path)
        assert resp.status_code == 302
        newkeycount = ProjectKey.objects.filter(project=self.project).count()
        assert newkeycount == keycount + 1
