from sentry.api.endpoints.project_app_store_connect_credentials import (
    AppStoreUpdateCredentialsSerializer,
)
from sentry.utils import json


class TestAppStoreUpdateCredentialsSerializer:
    def test_validate_secrets_magic_object_true(self):
        payload_json = """{
            "appconnectPrivateKey": { "hidden-secret": true },
            "itunesPassword":  { "hidden-secret": true },
            "itunesSession":  { "hidden-secret": true }
        }"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert serializer.is_valid(), serializer.errors

        data = serializer.validated_data

        assert data["appconnectPrivateKey"] is None
        assert data["itunesPassword"] is None
        # This is in the list of secret fields, but it shouldn't be included
        # after deserialization since it's not a member of AppStoreUpdateCredentials
        assert "itunesSession" not in data

    def test_validate_secrets_magic_object_false(self):
        payload_json = """{
            "appconnectPrivateKey": { "hidden-secret": false },
            "itunesPassword":  { "hidden-secret": false },
            "itunesSession":  { "hidden-secret": false }
        }"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert not serializer.is_valid()

        assert serializer.errors["appconnectPrivateKey"][0].code == "invalid"
        assert serializer.errors["itunesPassword"][0].code == "invalid"
        # This is in the list of secret fields, but it shouldn't be included
        # after deserialization since it's not a member of AppStoreUpdateCredentials
        assert "itunesSession" not in serializer.errors

    def test_validate_secrets_null(self):
        payload_json = """{
            "appconnectPrivateKey": null,
            "itunesPassword": null,
            "itunesSession": null
        }"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert not serializer.is_valid()

        assert serializer.errors["appconnectPrivateKey"][0].code == "null"
        assert serializer.errors["itunesPassword"][0].code == "null"
        # This is in the list of secret fields, but it shouldn't be included
        # after deserialization since it's not a member of AppStoreUpdateCredentials
        assert "itunesSession" not in serializer.errors

    # also equivalent to
    # {
    #    "appconnectPrivateKey": undefined,
    #    "itunesPassword": undefined,
    #    "itunesSession": undefined
    # }
    def test_validate_secrets_absent(self):
        payload_json = """{
            "appId": "honk"
        }"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert serializer.is_valid(), serializer.errors

        data = serializer.validated_data

        assert data["appId"] == "honk"
        assert "appconnectPrivateKey" not in data
        assert "itunesPassword" not in data
        assert "itunesSession" not in data

    def test_validate_secrets_empty_string(self):
        payload_json = """{
            "appconnectPrivateKey": "",
            "itunesPassword": "",
            "itunesSession": ""
        }"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert not serializer.is_valid()

        # There's no meaning to setting this to empty string, the entire set of
        # credentials should be deleted instead of this
        assert serializer.errors["appconnectPrivateKey"][0].code == "blank"
        assert serializer.errors["itunesPassword"][0].code == "blank"
        assert "itunesSession" not in serializer.errors

    def test_validate_secrets_string(self):
        payload_json = """{
            "appconnectPrivateKey": "honk",
            "itunesPassword": "beep",
            "itunesSession": "beep"
        }"""

        payload = json.loads(payload_json)
        serializer = AppStoreUpdateCredentialsSerializer(data=payload)
        assert serializer.is_valid(), serializer.errors

        data = serializer.validated_data

        assert data["appconnectPrivateKey"] == "honk"
        assert data["itunesPassword"] == "beep"
        # This is in the list of secret fields, but it shouldn't be included
        # after deserialization since it's not a member of AppStoreUpdateCredentials
        assert "itunesSession" not in serializer.errors
