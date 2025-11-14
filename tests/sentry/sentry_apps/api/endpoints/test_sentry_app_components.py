from typing import int
from collections.abc import Sequence
from unittest.mock import MagicMock, patch

import responses
from rest_framework.exceptions import ParseError

from sentry.api.serializers.base import serialize
from sentry.constants import SentryAppInstallationStatus
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


def get_sentry_app_avatars(sentry_app: SentryApp) -> list[dict[str, str | bool | int]]:
    return [serialize(avatar) for avatar in sentry_app.avatar.all()]


@control_silo_test
class SentryAppComponentsTest(APITestCase):
    endpoint = "sentry-api-0-sentry-app-components"

    def setUp(self) -> None:
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

    def test_retrieves_all_components(self) -> None:
        response = self.get_success_response(self.sentry_app.slug)

        assert response.data[0] == {
            "uuid": str(self.component.uuid),
            "type": "issue-link",
            "schema": self.component.schema,
            "error": "",
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

    def setUp(self) -> None:
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
    def test_retrieves_all_components_for_installed_apps(self, run: MagicMock) -> None:
        response = self.get_success_response(
            self.org.slug, qs_params={"projectId": self.project.id}
        )

        assert self.component3.uuid not in [d["uuid"] for d in response.data]
        components = {d["uuid"]: d for d in response.data}

        assert components[str(self.component1.uuid)] == {
            "uuid": str(self.component1.uuid),
            "type": "issue-link",
            "schema": self.component1.schema,
            "error": "",
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
            "error": "",
            "sentryApp": {
                "uuid": self.sentry_app2.uuid,
                "slug": self.sentry_app2.slug,
                "name": self.sentry_app2.name,
                "avatars": get_sentry_app_avatars(self.sentry_app2),
            },
        }

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_filter_by_type(self, run: MagicMock) -> None:
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
                "error": "",
                "sentryApp": {
                    "uuid": sentry_app.uuid,
                    "slug": sentry_app.slug,
                    "name": sentry_app.name,
                    "avatars": get_sentry_app_avatars(sentry_app),
                },
            }
        ]

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_prepares_each_component(self, run: MagicMock) -> None:
        self.get_success_response(self.org.slug, qs_params={"projectId": self.project.id})

        assert run.call_count == 2

    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_component_prep_errors_are_isolated(self, run: MagicMock) -> None:
        run.side_effect = [
            SentryAppIntegratorError(message="zoinks!", public_context={"foo": "bar"}),
            self.component2,
        ]

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
                "error": {"detail": "zoinks!", "context": {"foo": "bar"}},
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
                "error": "",
                "sentryApp": {
                    "uuid": self.sentry_app2.uuid,
                    "slug": self.sentry_app2.slug,
                    "name": self.sentry_app2.name,
                    "avatars": get_sentry_app_avatars(self.sentry_app2),
                },
            },
        ]

        assert response.data == expected

    @responses.activate
    def test_component_prep_api_error(self) -> None:
        responses.add(
            method=responses.GET,
            url="https://example.com/",
            json={"error": "the dumpsters on fire!!!"},
            status=500,
            content_type="application/json",
        )

        responses.add(
            method=responses.GET,
            url="https://example.com/",
            json={"error": "couldnt find the dumpsters :C"},
            status=404,
            content_type="application/json",
        )

        response = self.get_success_response(
            self.org.slug, qs_params={"projectId": self.project.id}
        )
        expected = [
            {
                "uuid": str(self.component1.uuid),
                "type": self.component1.type,
                "schema": self.component1.schema,
                "error": {
                    "detail": f"Something went wrong while getting options for Select FormField from {self.sentry_app1.slug}"
                },
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
                "error": {
                    "detail": f"Something went wrong while getting options for Select FormField from {self.sentry_app2.slug}"
                },
                "sentryApp": {
                    "uuid": self.sentry_app2.uuid,
                    "slug": self.sentry_app2.slug,
                    "name": self.sentry_app2.name,
                    "avatars": get_sentry_app_avatars(self.sentry_app2),
                },
            },
        ]

        assert response.data == expected

    @responses.activate
    def test_component_prep_validation_error(self) -> None:
        component1_uris = self._get_component_uris(
            component_field="link", component=self.component1
        )

        component2_uris = self._get_component_uris(
            component_field="link", component=self.component2
        )

        # We only get the first uri since the SentryAppComponentPreparer will short circuit after getting the first error
        responses.add(
            method=responses.GET,
            url=f"https://example.com{component1_uris[0]}?installationId={self.install1.uuid}",
            json=[{"bruh": "the dumpsters on fire!!!"}],
            status=200,
            content_type="application/json",
        )

        responses.add(
            method=responses.GET,
            url=f"https://example.com{component2_uris[0]}?installationId={self.install2.uuid}",
            json={},
            status=200,
            content_type="application/json",
        )

        response = self.get_success_response(
            self.org.slug, qs_params={"projectId": self.project.id}
        )
        expected = [
            {
                "uuid": str(self.component1.uuid),
                "type": self.component1.type,
                "schema": self.component1.schema,
                "error": {
                    "detail": "Missing `value` or `label` in option data for Select FormField"
                },
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
                "error": {
                    "detail": f"Invalid response format for Select FormField in {self.sentry_app2.slug} from uri: {component2_uris[0]}"
                },
                "sentryApp": {
                    "uuid": self.sentry_app2.uuid,
                    "slug": self.sentry_app2.slug,
                    "name": self.sentry_app2.name,
                    "avatars": get_sentry_app_avatars(self.sentry_app2),
                },
            },
        ]

        assert response.data == expected

    @patch("sentry_sdk.capture_exception")
    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_component_prep_general_error(
        self, run: MagicMock, capture_exception: MagicMock
    ) -> None:
        run.side_effect = [Exception(":dead:"), SentryAppSentryError("government secrets here")]
        capture_exception.return_value = 1
        response = self.get_success_response(
            self.org.slug, qs_params={"projectId": self.project.id}
        )
        expected = [
            {
                "uuid": str(self.component1.uuid),
                "type": self.component1.type,
                "schema": self.component1.schema,
                "error": {
                    "detail": f"Something went wrong while trying to link issue for component: {str(self.component1.uuid)}. Sentry error ID: {capture_exception.return_value}"
                },
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
                "error": {
                    "detail": f"Something went wrong while trying to link issue for component: {str(self.component2.uuid)}. Sentry error ID: {capture_exception.return_value}"
                },
                "sentryApp": {
                    "uuid": self.sentry_app2.uuid,
                    "slug": self.sentry_app2.slug,
                    "name": self.sentry_app2.name,
                    "avatars": get_sentry_app_avatars(self.sentry_app2),
                },
            },
        ]

        assert response.data == expected

    @patch("sentry_sdk.capture_exception")
    @patch("sentry.sentry_apps.components.SentryAppComponentPreparer.run")
    def test_component_prep_errors_dont_bring_down_everything(
        self, run: MagicMock, capture_exception: MagicMock
    ) -> None:
        run.side_effect = [ParseError(), SentryAppSentryError(message="kewl")]
        capture_exception.return_value = 1

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
                "error": {
                    "detail": f"Something went wrong while trying to link issue for component: {self.component1.uuid}. Sentry error ID: {capture_exception.return_value}"
                },
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
                "error": {
                    "detail": f"Something went wrong while trying to link issue for component: {self.component2.uuid}. Sentry error ID: {capture_exception.return_value}"
                },
                "sentryApp": {
                    "uuid": self.sentry_app2.uuid,
                    "slug": self.sentry_app2.slug,
                    "name": self.sentry_app2.name,
                    "avatars": get_sentry_app_avatars(self.sentry_app2),
                },
            },
        ]

        assert response.data == expected

    def _get_component_uris(
        self, component_field: str, component: SentryAppComponent
    ) -> Sequence[str]:
        fields = dict(**component.app_schema).get(component_field)
        assert fields, "component field was not found in the schema"
        uris = []

        for field in fields.get("required_fields", []):
            if "uri" in field:
                uris.append(field.get("uri"))

        for field in fields.get("optional_fields", []):
            if "uri" in field:
                uris.append(field.get("uri"))

        return uris
