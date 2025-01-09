from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.testutils.cases import APITestCase


class OrganizationSamplingProjectRatesTest(APITestCase):
    endpoint = "sentry-api-0-organization-sampling-project-rates"

    def setUp(self):
        super().setUp()

        self.features = {
            "organizations:dynamic-sampling": True,
            "organizations:dynamic-sampling-custom": True,
        }

        self.organization.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        self.login_as(user=self.user)

    def test_without_ds(self):
        self.get_error_response(self.organization.slug, status_code=404)

    def test_get(self):
        project1 = self.create_project(teams=[self.team])
        project2 = self.create_project(teams=[self.team])
        project2.update_option("sentry:target_sample_rate", 0.2)

        with self.feature(self.features):
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
        project3 = self.create_project(teams=[self.team])
        project3.update_option("sentry:target_sample_rate", 0.2)

        data = [
            # we leave project 1 unchanged
            {"id": project2.id, "sampleRate": 0.5},
            {"id": project3.id, "sampleRate": 0.123456789},
        ]

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug, method="put", raw_data=data
            )

        assert response.data == [
            {"id": project2.id, "sampleRate": 0.5},
            {"id": project3.id, "sampleRate": 0.1235},
        ]

        assert project1.get_option("sentry:target_sample_rate") == 0.2
        assert project2.get_option("sentry:target_sample_rate") == 0.5
        assert project3.get_option("sentry:target_sample_rate") == 0.1235

    def test_put_automatic_mode(self):
        self.organization.update_option(
            "sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION.value
        )

        data = [{"id": self.project.id, "sampleRate": 0.5}]
        with self.feature(self.features):
            self.get_error_response(self.organization.slug, method="put", raw_data=data)

    def test_put_invalid_body(self):
        with self.feature(self.features):
            self.get_error_response(
                self.organization.slug, method="put", raw_data={}, status_code=400
            )
