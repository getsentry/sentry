from sentry.testutils import APITestCase


class ProjectMetricsTest(APITestCase):

    endpoint = "sentry-api-0-project-metrics-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_response(self):
        response = self.get_valid_response(self.project.organization.slug, self.project.slug)

        required_fields = {"name", "operations", "tags"}
        optional_fields = {"unit"}

        for item in response.data:

            # All required fields are there:
            assert required_fields <= item.keys()

            # Only optional field is unit:
            additional_fields = item.keys() - required_fields
            if additional_fields:
                assert additional_fields <= optional_fields


class ProjectMetricsTagsTest(APITestCase):

    endpoint = "sentry-api-0-project-metrics-tags"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_unknown_metric(self):
        response = self.get_response(
            self.project.organization.slug, self.project.slug, "foo", "bar"
        )

        assert response.status_code == 400

    def test_unknown_tag(self):
        response = self.get_response(
            self.project.organization.slug, self.project.slug, "user", "bar"
        )

        assert response.status_code == 400

    def test_existing_tag(self):
        response = self.get_valid_response(
            self.project.organization.slug, self.project.slug, "user", "environment"
        )

        assert response.status_code == 200

        # Check if data are sane:
        assert isinstance(response.data, list)
        assert all(isinstance(item, str) for item in response.data)


class ProjectMetricsDataTest(APITestCase):

    endpoint = "sentry-api-0-project-metrics-data"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_missing_field(self):
        response = self.get_response(
            self.project.organization.slug,
            self.project.slug,
        )

        assert response.status_code == 400

    def test_invalid_field(self):

        for field in ["", "(*&%", "foo(session", "foo(session)", "sum(bar)"]:
            response = self.get_response(
                self.project.organization.slug, self.project.slug, field=field
            )

            assert response.status_code == 400

    def test_valid_operation(self):
        response = self.get_response(
            self.project.organization.slug, self.project.slug, field="sum(session)"
        )

        assert response.status_code == 200

        # Only one group:
        groups = response.data["groups"]
        assert len(groups) == 1 and groups[0]["by"] == {}

    def test_unknown_tag(self):
        response = self.get_response(
            self.project.organization.slug,
            self.project.slug,
            field="sum(session)",
            groupBy="foo",
        )

        assert response.status_code == 400

    def test_known_tag(self):
        response = self.get_response(
            self.project.organization.slug,
            self.project.slug,
            field="sum(session)",
            groupBy="environment",
        )

        assert response.status_code == 200

    def test_two_tags(self):
        response = self.get_response(
            self.project.organization.slug,
            self.project.slug,
            field="sum(session)",
            groupBy=["environment", "session.status"],
        )

        assert response.status_code == 200

        groups = response.data["groups"]
        assert len(groups) >= 2 and all(
            group["by"].keys() == {"environment", "session.status"} for group in groups
        )

    def test_invalid_filter(self):

        for query in [
            "%w45698u",
            "release:",
            "release:foo or ",
            "foo:bar",  # Unknown tag
            "release:foo and bar:baz",  # Unknown tag
        ]:

            response = self.get_response(
                self.project.organization.slug,
                self.project.slug,
                field="sum(session)",
                groupBy="environment",
                query=query,
            )

            assert response.status_code == 400

    def test_valid_filter(self):

        for query in [
            "release:2.0.0",
            "release:2.0.0 and environment:production",
            "release:2.0.0 and environment:production or session.status:healthy",
        ]:

            response = self.get_success_response(
                self.project.organization.slug,
                self.project.slug,
                field="sum(session)",
                groupBy="environment",
                query=query,
            )
            assert response.data.keys() == {"start", "end", "query", "intervals", "groups"}
