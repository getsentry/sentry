from unittest import mock

import django.urls
import pytest
from django.test import override_settings

import sentry.tasks.app_store_connect
from sentry.api.endpoints.project_app_store_connect_credentials import (
    AppStoreUpdateCredentialsSerializer,
)
from sentry.lang.native.appconnect import AppStoreConnectConfig
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


class TestAppStoreUpdateCredentialsSerializer:
    def test_validate_secrets_magic_object_true(self):
        payload_json = """{"appconnectPrivateKey": {"hidden-secret": true}}"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert serializer.is_valid(), serializer.errors

        data = serializer.validated_data

        assert data["appconnectPrivateKey"] is None

    def test_validate_secrets_magic_object_false(self):
        payload_json = """{"appconnectPrivateKey": {"hidden-secret": false}}"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert not serializer.is_valid()

        assert serializer.errors["appconnectPrivateKey"][0].code == "invalid"

    def test_validate_secrets_null(self):
        payload_json = """{"appconnectPrivateKey": null}"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert not serializer.is_valid()

        assert serializer.errors["appconnectPrivateKey"][0].code == "null"

    # also equivalent to
    # {
    #    "appconnectPrivateKey": undefined,
    # }
    def test_validate_secrets_absent(self):
        payload_json = """{"appId": "honk"}"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert serializer.is_valid(), serializer.errors

        data = serializer.validated_data

        assert data["appId"] == "honk"
        assert "appconnectPrivateKey" not in data

    def test_validate_secrets_empty_string(self):
        payload_json = """{"appconnectPrivateKey": ""}"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert not serializer.is_valid()

        # There's no meaning to setting this to empty string, the entire set of
        # credentials should be deleted instead of this
        assert serializer.errors["appconnectPrivateKey"][0].code == "blank"

    def test_validate_secrets_string(self):
        payload_json = """{"appconnectPrivateKey": "honk"}"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert serializer.is_valid(), serializer.errors

        data = serializer.validated_data

        assert data["appconnectPrivateKey"] == "honk"


class TestAppStoreConnectRefreshEndpoint:
    @pytest.fixture
    def config_id(self, default_project):
        """A valid App Store Connect symbol server config ID."""
        cfg_id = "abc123"
        cfg = AppStoreConnectConfig.from_json(
            {
                "type": "appStoreConnect",
                "id": cfg_id,
                "name": "Apple App Store Connect",
                "appconnectIssuer": "abc123" * 6,
                "appconnectKey": "abc123",
                "appconnectPrivateKey": "---- BEGIN PRIVATE KEY ---- ABC123...",
                "appName": "Sample Application",
                "appId": "1234",
                "bundleId": "com.example.app",
            }
        )
        cfg.update_project_symbol_source(default_project, allow_multiple=True)
        return cfg_id

    @pytest.fixture
    def mocked_dsym_download_task(self, monkeypatch):
        dsym_download_task = mock.Mock()
        monkeypatch.setattr(
            sentry.tasks.app_store_connect, "inner_dsym_download", dsym_download_task
        )
        return dsym_download_task

    @pytest.fixture
    def refresh_url(self, default_project, default_organization, config_id):
        return django.urls.reverse(
            "sentry-api-0-project-appstoreconnect-refresh",
            kwargs={
                "project_slug": default_project.slug,
                "organization_slug": default_organization.slug,
                "credentials_id": config_id,
            },
        )

    @django_db_all
    def test_ok(
        self,
        client,
        default_user,
        default_project,
        config_id,
        mocked_dsym_download_task,
        refresh_url,
    ):
        client.login(username=default_user.username, password="admin")

        response = client.post(refresh_url, format="json")

        assert response.status_code == 200, response.content
        assert mocked_dsym_download_task.call_assert_called_once_with(
            project_id=default_project.id, config_id=config_id
        )

    @django_db_all
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_rate_limited(self, client, default_user, mocked_dsym_download_task, refresh_url):
        client.login(username=default_user.username, password="admin")
        for i in range(5):
            client.post(refresh_url, format="json")
        mocked_dsym_download_task.reset_mock()

        response = client.post(refresh_url, format="json")

        assert response.status_code == 429, response.content
        assert not mocked_dsym_download_task.called
