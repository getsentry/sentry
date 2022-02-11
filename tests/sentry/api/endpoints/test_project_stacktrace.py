from django.urls import reverse

from sentry.models import ApiToken
from sentry.testutils import APITestCase


class ProjectStacktraceTest(APITestCase):
    def test_feature_flag_disabled(self):
        token = ApiToken.objects.create(user=self.user, scope_list=["project:read"])
        url = reverse(
            "sentry-api-0-project-stacktrace",
            args=(
                self.project.organization.slug,
                self.project.id,
                "randomtransactionid",
            ),
        )
        response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")
        assert response.status_code == 404
