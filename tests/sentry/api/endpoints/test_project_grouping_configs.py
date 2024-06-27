from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode


class ProjectGroupingConfigsTest(APITestCase):

    endpoint = "sentry-api-0-project-grouping-configs"

    def test_permissions(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=[])
        url = reverse(self.endpoint, args=(self.project.organization.slug, self.project.slug))
        response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

        assert response.status_code == 403
