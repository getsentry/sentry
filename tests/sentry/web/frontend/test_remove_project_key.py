from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import ProjectKey
from sentry.testutils import TestCase


class RemoveProjectKeyTest(TestCase):
    def setUp(self):
        super(RemoveProjectKeyTest, self).setUp()
        self.key = ProjectKey.objects.create(project=self.project)

    @fixture
    def path(self):
        return reverse('sentry-remove-project-key', args=[self.organization.slug, self.project.slug, self.key.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_removes_key_and_redirects(self):
        self.login_as(self.user)

        resp = self.client.post(self.path)
        assert resp.status_code == 302
        assert not ProjectKey.objects.filter(id=self.key.id).exists()
