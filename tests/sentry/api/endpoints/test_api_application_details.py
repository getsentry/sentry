from django.urls import reverse

from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.scheduledeletion import ScheduledDeletion
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ApiApplicationDetailsTest(APITestCase):
    def test_simple(self):
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])
        response = self.client.get(url)
        assert response.status_code == 200, (response.status_code, response.content)
        assert response.data["id"] == app.client_id


@control_silo_test
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


@control_silo_test
class ApiApplicationDeleteTest(APITestCase):
    def test_simple(self):
        app = ApiApplication.objects.create(owner=self.user, name="a")

        self.login_as(self.user)
        url = reverse("sentry-api-0-api-application-details", args=[app.client_id])
        response = self.client.delete(url)
        assert response.status_code == 204, response.content

        app = ApiApplication.objects.get(id=app.id)
        assert app.status == ApiApplicationStatus.pending_deletion
        assert ScheduledDeletion.objects.filter(
            object_id=app.id, model_name="ApiApplication"
        ).exists()
