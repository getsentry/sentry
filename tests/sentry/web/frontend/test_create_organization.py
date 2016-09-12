from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import Organization, OrganizationMember
from sentry.testutils import TestCase


class CreateOrganizationTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-create-organization')

    def test_renders_with_context(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-organization.html')
        assert resp.context['form']

    def test_valid_params(self):
        self.login_as(self.user)
        resp = self.client.post(self.path, {
            'name': 'bar',
        })
        assert resp.status_code == 302

        org = Organization.objects.get(name='bar')

        assert OrganizationMember.objects.filter(
            organization=org,
            user=self.user,
            role='owner',
        ).exists()

        assert org.team_set.exists()

        redirect_uri = reverse('sentry-create-project', args=[org.slug])
        assert resp['Location'] == 'http://testserver%s' % (
            redirect_uri,
        )
