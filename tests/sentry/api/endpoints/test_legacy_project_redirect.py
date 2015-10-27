from __future__ import absolute_import

from sentry.testutils import APITestCase


class LegacyProjectRedirectTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        # Explicitly test against the url pattern
        url = '/api/0/projects/%d/stats/' % self.project.pk
        response = self.client.get(url, format='json')

        assert response.status_code == 302, response.content
        assert response['Location'] == 'http://example.com/api/0/projects/baz/bar/stats/'
