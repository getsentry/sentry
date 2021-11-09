from sentry.api.endpoints.project_app_store_connect_credentials import (
    AppStoreUpdateCredentialsSerializer,
)
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
