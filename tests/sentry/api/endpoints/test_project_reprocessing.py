from sentry.testutils.cases import APITestCase


class ProjectReprocessingTest(APITestCase):
    endpoint = "sentry-api-0-project-reprocessing"

    def test_post_triggers_reprocessing(self) -> None:
        self.login_as(user=self.user)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, method="POST", status_code=200
        )
        assert response.status_code == 200
