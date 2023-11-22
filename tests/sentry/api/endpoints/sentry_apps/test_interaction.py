from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test

COMPONENT_TYPES = ["stacktrace-link", "issue-link"]


class SentryAppInteractionTest(APITestCase):
    endpoint = "sentry-api-0-sentry-app-interaction"

    def setUp(self):
        super().setUp()

        self.published_app = self.create_sentry_app(
            name="Published App",
            organization=self.organization,
            published=True,
            schema={"elements": [self.create_issue_link_schema()]},
        )
        self.unowned_published_app = self.create_sentry_app(
            name="Unowned Published App",
            organization=self.create_organization(),
            published=True,
        )


@region_silo_test
class SentryAppInteractionAuthTest(SentryAppInteractionTest):
    def test_not_logged_in_not_allowed(self):
        response = self.get_error_response(
            self.published_app.slug,
            tsdbField="sentry_app_viewed",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
        assert response.data["detail"] == "Authentication credentials were not provided."

        response = self.get_error_response(
            self.published_app.slug,
            tsdbField="sentry_app_viewed",
            method="post",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
        assert response.data["detail"] == "Authentication credentials were not provided."

    def test_superuser_sees_unowned_interactions(self):
        superuser = self.create_user(email="superuser@example.com", is_superuser=True)
        self.login_as(superuser, superuser=True)

        response = self.get_success_response(self.unowned_published_app.slug)

        assert len(response.data["views"]) > 0
        assert response.data["componentInteractions"] == {}


@region_silo_test
class GetSentryAppInteractionTest(SentryAppInteractionTest):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_user_sees_owned_interactions(self):
        response = self.get_success_response(self.published_app.slug)

        assert len(response.data["views"]) > 0
        assert "issue-link" in response.data["componentInteractions"]

    def test_user_does_not_see_unowned_interactions(self):
        response = self.get_error_response(
            self.unowned_published_app.slug,
            status_code=status.HTTP_403_FORBIDDEN,
        )
        assert response.data["detail"] == "You do not have permission to perform this action."

    def test_invalid_startend_throws_error(self):
        self.get_error_response(
            self.published_app.slug,
            qs_params={"since": 1569523068, "until": 1566931068},
            status_code=status.HTTP_400_BAD_REQUEST,
        )


@region_silo_test
class PostSentryAppInteractionTest(SentryAppInteractionTest):
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_missing_tsdb_field(self):
        response = self.get_error_response(
            self.published_app.slug,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            response.data["detail"]
            == "The tsdbField must be one of: sentry_app_viewed, sentry_app_component_interacted"
        )

    def test_incorrect_tsdb_field(self):
        response = self.get_error_response(
            self.published_app.slug,
            tsdbField="invalid",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            response.data["detail"]
            == "The tsdbField must be one of: sentry_app_viewed, sentry_app_component_interacted"
        )

    def test_missing_component_type(self):
        response = self.get_error_response(
            self.published_app.slug,
            tsdbField="sentry_app_component_interacted",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            response.data["detail"]
            == f"The field componentType is required and must be one of {COMPONENT_TYPES}"
        )

    def test_incorrect_component_type(self):
        response = self.get_error_response(
            self.published_app.slug,
            tsdbField="sentry_app_component_interacted",
            componentType="wrong",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            response.data["detail"]
            == f"The field componentType is required and must be one of {COMPONENT_TYPES}"
        )

    def test_allows_logged_in_user_who_doesnt_own_app(self):
        self.get_success_response(
            self.unowned_published_app.slug,
            tsdbField="sentry_app_component_interacted",
            componentType="issue-link",
            status_code=status.HTTP_201_CREATED,
        )
        self.get_success_response(
            self.unowned_published_app.slug,
            tsdbField="sentry_app_viewed",
            status_code=status.HTTP_201_CREATED,
        )

    def test_allows_logged_in_user_who_does_own_app(self):
        self.get_success_response(
            self.published_app.slug,
            tsdbField="sentry_app_component_interacted",
            componentType="issue-link",
            status_code=status.HTTP_201_CREATED,
        )
        self.get_success_response(
            self.published_app.slug,
            tsdbField="sentry_app_viewed",
            status_code=status.HTTP_201_CREATED,
        )
