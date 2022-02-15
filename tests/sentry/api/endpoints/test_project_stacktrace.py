from django.urls import reverse

from sentry.testutils import APITestCase


class ProjectStacktraceTest(APITestCase):
    def setUp(self):
        self.endpoint = reverse(
            "sentry-api-0-project-stacktrace",
            args=(
                self.project.organization.slug,
                self.project.id,
                "randomtransactionid",
            ),
        )
        self.login_as(user=self.user)

    def test_feature_flag_disabled(self):
        response = self.get_response(self.project.organization.slug)
        assert response.status_code == 404
