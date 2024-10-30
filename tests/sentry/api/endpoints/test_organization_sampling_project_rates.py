from sentry.testutils.cases import APITestCase


class OrganizationSamplingProjectRatesTest(APITestCase):
    endpoint = "sentry-api-0-organization-sampling-project-rates"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_get(self):
        project1 = self.create_project(teams=[self.team])
        project2 = self.create_project(teams=[self.team])
        project2.update_option("sentry:target_sample_rate", 0.2)

        response = self.get_success_response(self.organization.slug)
        assert response.data == [
            {"id": project1.id, "sampleRate": None},  # TODO: This must be 1.0
            {"id": project2.id, "sampleRate": 0.2},
        ]
