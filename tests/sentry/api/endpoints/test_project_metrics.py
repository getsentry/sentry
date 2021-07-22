from django.urls import reverse

from sentry.models import ApiToken
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature

FEATURE_FLAG = "organizations:metrics"


class ProjectMetricsPermissionTest(APITestCase):

    endpoints = (
        ("sentry-api-0-project-metrics-index",),
        ("sentry-api-0-project-metric-details", "foo"),
        ("sentry-api-0-project-metrics-tags",),
        ("sentry-api-0-project-metrics-tag-details", "foo"),
        ("sentry-api-0-project-metrics-data",),
    )

    def send_get_request(self, token, endpoint, *args):
        url = reverse(endpoint, args=(self.project.organization.slug, self.project.slug) + args)
        return self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

    @with_feature(FEATURE_FLAG)
    def test_permissions(self):

        token = ApiToken.objects.create(user=self.user, scope_list=[])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code == 403

        token = ApiToken.objects.create(user=self.user, scope_list=["project:read"])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code in (200, 400, 404)

    def test_feature_flag(self):
        token = ApiToken.objects.create(user=self.user, scope_list=["project:read"])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code == 404


class ProjectMetricsTest(APITestCase):

    endpoint = "sentry-api-0-project-metrics-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_response(self):
        response = self.get_valid_response(self.project.organization.slug, self.project.slug)

        required_fields = {"name", "operations"}
        optional_fields = {"unit"}

        for item in response.data:

            # All required fields are there:
            assert required_fields <= item.keys()

            # Only optional field is unit:
            additional_fields = item.keys() - required_fields
            if additional_fields:
                assert additional_fields <= optional_fields


class ProjectMetricDetailsTest(APITestCase):

    endpoint = "sentry-api-0-project-metric-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_unknown_metric(self):
        response = self.get_response(self.project.organization.slug, self.project.slug, "foo")

        assert response.status_code == 404

    @with_feature(FEATURE_FLAG)
    def test_valid_response(self):

        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, "session"
        )

        assert response.data["name"] == "session"
        assert "tags" in response.data
        assert all(isinstance(item, str) for item in response.data["tags"])


class ProjectMetricsTagsTest(APITestCase):

    endpoint = "sentry-api-0-project-metrics-tags"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_response(self):
        response = self.get_success_response(self.project.organization.slug, self.project.slug)

        # Check if data are sane:
        assert isinstance(response.data, list)
        assert all(isinstance(item, str) for item in response.data)

        # Check if intersection works:
        assert "environment" in response.data
        assert "custom_session_tag" in response.data  # from 'session' tags
        assert "custom_user_tag" in response.data  # from 'user' tags

    @with_feature(FEATURE_FLAG)
    def test_filtered_response(self):

        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, metric="session"
        )

        # Check that only tags from this metrics appear:
        assert "environment" in response.data
        assert "custom_session_tag" in response.data  # from 'session' tags
        assert "custom_user_tag" not in response.data  # from 'user' tags

    @with_feature(FEATURE_FLAG)
    def test_two_filters(self):

        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, metric=["user", "session"]
        )

        # Check that only tags from this metrics appear:
        assert "environment" in response.data
        assert "custom_session_tag" not in response.data  # from 'session' tags
        assert "custom_user_tag" not in response.data  # from 'user' tags

    @with_feature(FEATURE_FLAG)
    def test_bad_filter(self):
        response = self.get_response(
            self.project.organization.slug, self.project.slug, metric="bad"
        )

        assert response.status_code == 400


class ProjectMetricsTagDetailsTest(APITestCase):

    endpoint = "sentry-api-0-project-metrics-tag-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_unknown_tag(self):
        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, "bar"
        )

        assert response.data == []

    @with_feature(FEATURE_FLAG)
    def test_existing_tag(self):
        response = self.get_valid_response(
            self.project.organization.slug, self.project.slug, "environment"
        )

        assert response.status_code == 200

        # Check if data are sane:
        assert isinstance(response.data, list)
        for item in response.data:
            assert isinstance(item, str), item

        assert "production" in response.data

    @with_feature(FEATURE_FLAG)
    def test_filtered_response(self):

        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            "custom_session_tag",
            metric="session",
        )

        # Check that only tags from this metrics appear:
        assert set(response.data) == {"foo", "bar"}

    @with_feature(FEATURE_FLAG)
    def test_two_filters(self):

        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            "environment",
            metric=["user", "session"],
        )

        assert set(response.data) == {"production", "staging"}

    @with_feature(FEATURE_FLAG)
    def test_bad_filter(self):
        response = self.get_response(
            self.project.organization.slug, self.project.slug, "environment", metric="bad"
        )

        assert response.status_code == 400


class ProjectMetricsDataTest(APITestCase):

    endpoint = "sentry-api-0-project-metrics-data"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(FEATURE_FLAG)
    def test_missing_field(self):
        response = self.get_response(
            self.project.organization.slug,
            self.project.slug,
        )

        assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_invalid_field(self):

        for field in ["", "(*&%", "foo(session", "foo(session)", "sum(bar)"]:
            response = self.get_response(
                self.project.organization.slug, self.project.slug, field=field
            )

            assert response.status_code == 400

    @with_feature(FEATURE_FLAG)
    def test_valid_operation(self):
        response = self.get_response(
            self.project.organization.slug, self.project.slug, field="sum(session)"
        )

        assert response.status_code == 200

        # Only one group:
        groups = response.data["groups"]
        assert len(groups) == 1 and groups[0]["by"] == {}

    @with_feature(FEATURE_FLAG)
    def test_groupby_single(self):
        response = self.get_response(
            self.project.organization.slug,
            self.project.slug,
            field="sum(session)",
            groupBy="environment",
        )

        assert response.status_code == 200

    @with_feature(FEATURE_FLAG)
    def test_groupby_multiple(self):
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

    @with_feature(FEATURE_FLAG)
    def test_invalid_filter(self):

        for query in [
            "%w45698u",
            "release:foo or ",
        ]:

            response = self.get_response(
                self.project.organization.slug,
                self.project.slug,
                field="sum(session)",
                groupBy="environment",
                query=query,
            )

            assert response.status_code == 400, query

    @with_feature(FEATURE_FLAG)
    def test_valid_filter(self):

        for query in [
            "release:",  # Empty string is OK
            "release:myapp@2.0.0",
            "release:myapp@2.0.0 and environment:production",
            "release:myapp@2.0.0 and environment:production or session.status:healthy",
        ]:

            response = self.get_success_response(
                self.project.organization.slug,
                self.project.slug,
                field="sum(session)",
                groupBy="environment",
                query=query,
            )
            assert response.data.keys() == {"start", "end", "query", "intervals", "groups"}
