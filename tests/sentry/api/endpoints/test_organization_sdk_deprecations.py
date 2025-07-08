from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.models.projectsdk import EventType, ProjectSDK
from sentry.testutils.cases import APITestCase


class TestOrganizationSdkDeprecations(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.url = reverse(
            "sentry-api-0-organization-sdk-deprecations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_no_event_type(self):
        response = self.client.get(self.url, format="json")
        assert response.status_code == 400, response.content
        assert response.data == {
            "event_type": [ErrorDetail(string="This field is required.", code="required")],
        }

    def test_unknown_event_type(self):
        response = self.client.get(
            self.url,
            {"event_type": "foo"},
            format="json",
        )
        assert response.status_code == 400, response.content
        assert response.data == {
            "event_type": [
                ErrorDetail(string='"foo" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_sdks_seen(self):
        response = self.client.get(
            self.url,
            {"event_type": "profile"},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.data == {"data": []}

    def test_sdk_non_semver_version(self):
        ProjectSDK.objects.create(
            project=self.project,
            event_type=EventType.PROFILE_CHUNK.value,
            sdk_name="sentry.python",
            sdk_version="something",
        )
        response = self.client.get(
            self.url,
            {"event_type": "profile"},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.data == {"data": []}

    def test_malformed_sdk_name(self):
        ProjectSDK.objects.create(
            project=self.project,
            event_type=EventType.PROFILE_CHUNK.value,
            sdk_name="idontknow",
            sdk_version="0.0.0",
        )
        response = self.client.get(
            self.url,
            {"event_type": "profile"},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.data == {"data": []}

    def test_sdk_with_no_minimum_version(self):
        ProjectSDK.objects.create(
            project=self.project,
            event_type=EventType.PROFILE_CHUNK.value,
            sdk_name="sentry.idontknow",
            sdk_version="0.0.0",
        )
        response = self.client.get(
            self.url,
            {"event_type": "profile"},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.data == {"data": []}

    def test_up_to_date_sdk(self):
        ProjectSDK.objects.create(
            project=self.project,
            event_type=EventType.PROFILE_CHUNK.value,
            sdk_name="sentry.python",
            sdk_version="2.24.1",
        )
        response = self.client.get(
            self.url,
            {"event_type": "profile"},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.data == {"data": []}

    def test_deprecated_sdk(self):
        ProjectSDK.objects.create(
            project=self.project,
            event_type=EventType.PROFILE_CHUNK.value,
            sdk_name="sentry.python",
            sdk_version="2.24.0",
        )
        response = self.client.get(
            self.url,
            {"event_type": "profile"},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "data": [
                {
                    "projectId": str(self.project.id),
                    "minimumVersion": "2.24.1",
                    "sdkName": "sentry.python",
                    "sdkVersion": "2.24.0",
                },
            ]
        }

    def test_mixed_sdks(self):
        ProjectSDK.objects.create(
            project=self.project,
            event_type=EventType.PROFILE_CHUNK.value,
            sdk_name="sentry.python",
            sdk_version="2.24.0",
        )
        ProjectSDK.objects.create(
            project=self.project,
            event_type=EventType.PROFILE_CHUNK.value,
            sdk_name="sentry.cocoa",
            sdk_version="8.49.2",
        )
        response = self.client.get(
            self.url,
            {"event_type": "profile"},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.data == {"data": []}
