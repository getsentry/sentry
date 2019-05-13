from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import ApiApplication, ApiApplicationStatus
from sentry.testutils import APITestCase


class ApiApplicationDetailsTest(APITestCase):
    def test_simple(self):
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])
        response = self.client.get(url)
        assert response.status_code == 200, (response.status_code, response.content)
        assert response.data["id"] == app.client_id


class ApiApplicationUpdateTest(APITestCase):
    def test_simple(self):
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])
        response = self.client.put(url, data={"name": "foobaz"})
        assert response.status_code == 200, (response.status_code, response.content)
        assert response.data["id"] == app.client_id

        app = ApiApplication.objects.get(id=app.id)
        assert app.name == "foobaz"


class ApiApplicationDeleteTest(APITestCase):
    def test_simple(self):
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])
        response = self.client.delete(url)
        assert response.status_code == 204, response.content

        app = ApiApplication.objects.get(id=app.id)
        assert app.status == ApiApplicationStatus.pending_deletion
