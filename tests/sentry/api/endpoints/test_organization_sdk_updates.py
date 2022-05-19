from unittest import mock

import pytest
from django.urls import reverse

from sentry.sdk_updates import SdkIndexState
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationSdkUpdates(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.project2 = self.create_project(organization=self.organization)

        self.url = reverse(
            "sentry-api-0-organization-sdk-updates",
            kwargs={"organization_slug": self.organization.slug},
        )
        self.features = {}

    @mock.patch(
        "sentry.api.endpoints.organization_sdk_updates.SdkIndexState",
        return_value=SdkIndexState(sdk_versions={"example.sdk": "2.0.0"}),
    )
    def test_simple(self, mock_index_state):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.feature(self.features):
            response = self.client.get(self.url)

        update_suggestions = response.data
        assert len(update_suggestions) == 1
        assert update_suggestions[0]["suggestions"][0] == {
            "type": "updateSdk",
            "sdkName": "example.sdk",
            "newSdkVersion": "2.0.0",
            "sdkUrl": None,
            "enables": [],
        }

    @mock.patch(
        "sentry.api.endpoints.organization_sdk_updates.SdkIndexState",
        return_value=SdkIndexState(sdk_versions={"example.sdk": "1.0.1"}),
    )
    def test_ignores_patch(self, mock_index_state):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.feature(self.features):
            response = self.client.get(self.url)

        update_suggestions = response.data
        assert len(update_suggestions) == 0

    def test_no_projects(self):
        org = self.create_organization()
        self.create_member(user=self.user, organization=org)

        url = reverse(
            "sentry-api-0-organization-sdk-updates",
            kwargs={"organization_slug": org.slug},
        )

        with self.feature(self.features):
            response = self.client.get(url)
        assert len(response.data) == 0

    def test_filtered_project(self):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.feature(self.features):
            response = self.client.get(f"{self.url}?project={self.project2.id}")

        assert len(response.data) == 0

    @mock.patch(
        "sentry.api.endpoints.organization_sdk_updates.SdkIndexState",
        return_value=SdkIndexState(sdk_versions={"example.sdk": "2.0.0"}),
    )
    def test_multiple_versions_with_latest(self, mock_index_state):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "a",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "b",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
                "sdk": {"name": "example.sdk", "version": "1.1.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "c",
                "timestamp": min_ago,
                "fingerprint": ["group-3"],
                "sdk": {"name": "example.sdk", "version": "2.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.feature(self.features):
            response = self.client.get(self.url)

        update_suggestions = response.data
        assert len(update_suggestions) == 0

    @mock.patch(
        "sentry.api.endpoints.organization_sdk_updates.SdkIndexState",
        return_value=SdkIndexState(sdk_versions={"example.sdk": "2.0.0"}),
    )
    def test_unknown_version(self, mock_index_state):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "dev-master@32e5415"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "b",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
                "sdk": {"name": "example.sdk", "version": "2.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with self.feature(self.features), pytest.warns(DeprecationWarning) as warninfo:
            response = self.client.get(self.url)

        update_suggestions = response.data
        assert len(update_suggestions) == 0

        # until it is turned into an error, we'll get a warning about parsing an invalid version
        (warning,) = warninfo
        (warn_msg,) = warning.message.args
        assert (
            warn_msg
            == "Creating a LegacyVersion has been deprecated and will be removed in the next major release"
        )
