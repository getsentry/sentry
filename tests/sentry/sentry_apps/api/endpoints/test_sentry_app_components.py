from unittest.mock import patch

from sentry.api.serializers.base import serialize
from sentry.constants import SentryAppInstallationStatus
from sentry.coreapi import APIError
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


def get_sentry_app_avatars(sentry_app: SentryApp):
    return [serialize(avatar) for avatar in sentry_app.avatar.all()]


@control_silo_test
class SentryAppComponentsTest(APITestCase):
    endpoint = "sentry-api-0-sentry-app-components"

    def setUp(self):
        self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = self.create_sentry_app(
            name="Test",
            organization=self.org,
            published=True,
            schema={"elements": [self.create_issue_link_schema()]},
        )

        self.component = self.sentry_app.components.first()

        self.login_as(user=self.user)

    def test_retrieves_all_components(self):
        response = self.get_success_response(self.sentry_app.slug)

        assert response.data[0] == {
            "uuid": str(self.component.uuid),
            "type": "issue-link",
            "schema": self.component.schema,
            "error": False,
            "sentryApp": {
                "uuid": self.sentry_app.uuid,
                "slug": self.sentry_app.slug,
                "name": self.sentry_app.name,
                "avatars": get_sentry_app_avatars(self.sentry_app),
            },
        }


@control_silo_test
class OrganizationSentryAppComponentsTest(APITestCase):
    endpoint = "sentry-api-0-organization-sentry-app-components"

    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

        self.sentry_app1 = self.create_sentry_app(
            schema={"elements": [self.create_issue_link_schema()]}
        )

        self.sentry_app2 = self.create_sentry_app(
            schema={"elements": [self.create_issue_link_schema()]}
        )

        self.sentry_app3 = self.create_sentry_app(
            schema={"elements": [self.create_issue_link_schema()]}
        )

        self.install1 = self.create_sentry_app_installation(
            slug=self.sentry_app1.slug, organization=self.org
        )

        self.install2 = self.create_sentry_app_installation(
            slug=self.sentry_app2.slug, organization=self.org
        )

        self.install3 = self.create_sentry_app_installation(
            slug=self.sentry_app3.slug,
            organization=self.org,
            status=SentryAppInstallationStatus.PENDING,
        )

        self.component1 = self.sentry_app1.components.order_by("pk").first()
        self.component2 = self.sentry_app2.components.order_by("pk").first()
        self.component3 = self.sentry_app3.components.order_by("pk").first()

        self.login_as(user=self.user)

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_retrieves_all_components_for_installed_apps(self, run):
        response = self.get_success_response(
            self.org.slug, qs_params={"projectId": self.project.id}
        )

        assert self.component3.uuid not in [d["uuid"] for d in response.data]
        components = {d["uuid"]: d for d in response.data}

        assert components[str(self.component1.uuid)] == {
            "uuid": str(self.component1.uuid),
            "type": "issue-link",
            "schema": self.component1.schema,
            "error": False,
            "sentryApp": {
                "uuid": self.sentry_app1.uuid,
                "slug": self.sentry_app1.slug,
                "name": self.sentry_app1.name,
                "avatars": get_sentry_app_avatars(self.sentry_app1),
            },
        }

        assert components[str(self.component2.uuid)] == {
            "uuid": str(self.component2.uuid),
            "type": "issue-link",
            "schema": self.component2.schema,
            "error": False,
            "sentryApp": {
                "uuid": self.sentry_app2.uuid,
                "slug": self.sentry_app2.slug,
                "name": self.sentry_app2.name,
                "avatars": get_sentry_app_avatars(self.sentry_app2),
            },
        }

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_filter_by_type(self, run):
        sentry_app = self.create_sentry_app(schema={"elements": [{"type": "alert-rule"}]})

        self.create_sentry_app_installation(slug=sentry_app.slug, organization=self.org)

        component = sentry_app.components.first()

        response = self.get_success_response(
            self.org.slug, qs_params={"projectId": self.project.id, "filter": "alert-rule"}
        )

        assert response.data == [
            {
                "uuid": str(component.uuid),
                "type": "alert-rule",
                "schema": component.schema,
                "error": False,
                "sentryApp": {
                    "uuid": sentry_app.uuid,
                    "slug": sentry_app.slug,
                    "name": sentry_app.name,
                    "avatars": get_sentry_app_avatars(sentry_app),
                },
            }
        ]

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_prepares_each_component(self, run):
        self.get_success_response(self.org.slug, qs_params={"projectId": self.project.id})

        assert run.call_count == 2

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_component_prep_errors_are_isolated(self, run):
        run.side_effect = [SentryAppIntegratorError(message="whoops"), self.component2]

        response = self.get_success_response(
            self.org.slug, qs_params={"projectId": self.project.id}
        )

        # self.component1 data contains an error, because it raised an exception
        # during preparation.
        expected = [
            {
                "uuid": str(self.component1.uuid),
                "type": self.component1.type,
                "schema": self.component1.schema,
                "error": True,
                "sentryApp": {
                    "uuid": self.sentry_app1.uuid,
                    "slug": self.sentry_app1.slug,
                    "name": self.sentry_app1.name,
                    "avatars": get_sentry_app_avatars(self.sentry_app1),
                },
            },
            {
                "uuid": str(self.component2.uuid),
                "type": self.component2.type,
                "schema": self.component2.schema,
                "error": False,
                "sentryApp": {
                    "uuid": self.sentry_app2.uuid,
                    "slug": self.sentry_app2.slug,
                    "name": self.sentry_app2.name,
                    "avatars": get_sentry_app_avatars(self.sentry_app2),
                },
            },
        ]

        assert response.data == expected

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_component_prep_errors_dont_bring_down_everything(self, run):
        run.side_effect = [APIError(), SentryAppSentryError(message="kewl")]

        response = self.get_success_response(
            self.org.slug, qs_params={"projectId": self.project.id}
        )

        # self.component1 data contains an error, because it raised an exception
        # during preparation.
        expected = [
            {
                "uuid": str(self.component1.uuid),
                "type": self.component1.type,
                "schema": self.component1.schema,
                "error": True,
                "sentryApp": {
                    "uuid": self.sentry_app1.uuid,
                    "slug": self.sentry_app1.slug,
                    "name": self.sentry_app1.name,
                    "avatars": get_sentry_app_avatars(self.sentry_app1),
                },
            },
            {
                "uuid": str(self.component2.uuid),
                "type": self.component2.type,
                "schema": self.component2.schema,
                "error": True,
                "sentryApp": {
                    "uuid": self.sentry_app2.uuid,
                    "slug": self.sentry_app2.slug,
                    "name": self.sentry_app2.name,
                    "avatars": get_sentry_app_avatars(self.sentry_app2),
                },
            },
        ]

        assert response.data == expected
