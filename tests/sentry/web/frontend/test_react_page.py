from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class ReactPageViewTest(TestCase):
    def test_renders_with_context(self):
        org = self.create_organization(owner=self.user)
        path = reverse('sentry-organization-home', args=[org.slug])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/bases/react.html')
        assert resp.context['request']

    def test_redirects_user_to_auth_without_membership(self):
        org = self.create_organization(owner=self.user)
        user = self.create_user('foo@example.com')

        path = reverse('sentry-organization-home', args=[org.slug])

        self.login_as(user)

        resp = self.client.get(path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver{}'.format(
            reverse('sentry-auth-organization', args=[org.slug]),
        )

        # ensure we dont redirect to auth if its not a valid org
        path = reverse('sentry-organization-home', args=['foobar'])

        resp = self.client.get(path)

        assert resp.status_code == 302
        assert resp['Location'] != 'http://testserver{}'.format(
            reverse('sentry-auth-organization', args=[org.slug]),
        )
