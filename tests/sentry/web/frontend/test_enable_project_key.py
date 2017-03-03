from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import ProjectKey, ProjectKeyStatus
from sentry.testutils import TestCase


class EnableProjectKeyTest(TestCase):
    def setUp(self):
        super(EnableProjectKeyTest, self).setUp()
        self.key = ProjectKey.objects.create(
            project=self.project,
            status=ProjectKeyStatus.INACTIVE,
        )

    @fixture
    def path(self):
        return reverse('sentry-enable-project-key', args=[self.organization.slug, self.project.slug, self.key.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_does_enable(self):
        self.login_as(self.user)

        resp = self.client.post(self.path)
        assert resp.status_code == 302
        key = ProjectKey.objects.get(id=self.key.id)
        assert key.status == ProjectKeyStatus.ACTIVE
