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
            {"id": project1.id, "sampleRate": 1.0},
            {"id": project2.id, "sampleRate": 0.2},
        ]

    def test_put(self):
        project1 = self.create_project(teams=[self.team])
        project1.update_option("sentry:target_sample_rate", 0.2)
        project2 = self.create_project(teams=[self.team])
        project2.update_option("sentry:target_sample_rate", 0.2)

        data = [
            # we leave project 1 unchanged
            {"id": project2.id, "sampleRate": 0.5},
        ]

        response = self.get_success_response(self.organization.slug, method="put", raw_data=data)
        assert response.data == [
            {"id": project2.id, "sampleRate": 0.5},
        ]

        assert project1.get_option("sentry:target_sample_rate") == 0.2
        assert project2.get_option("sentry:target_sample_rate") == 0.5

    def test_put_invalid_body(self):
        self.get_error_response(self.organization.slug, method="put", raw_data={})
