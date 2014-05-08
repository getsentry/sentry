from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase


class ProjectIndexTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        url = reverse('sentry-api-0-project-index')
        print url
        response = self.client.get(url)
        assert response.status_code == 200
