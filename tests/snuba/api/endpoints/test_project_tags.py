from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class ProjectTagsTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-project-tags"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        self.store_event(
            data={
                "tags": {"foo": "oof", "bar": "rab"},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={"tags": {"bar": "rab2"}, "timestamp": iso_format(before_now(minutes=1))},
            project_id=self.project.id,
        )

        response = self.get_valid_response(self.project.organization.slug, self.project.slug)

        data = {v["key"]: v for v in response.data}
        assert len(data) == 3

        assert data["foo"]["canDelete"]
        assert data["foo"]["uniqueValues"] == 1
        assert data["bar"]["canDelete"]
        assert data["bar"]["uniqueValues"] == 2
