from __future__ import annotations

from base64 import b64encode
from io import BytesIO
from typing import Any
from unittest import TestCase, mock

import pytest
from PIL import Image

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.saml2.provider import (
    Attributes,
    SAML2Provider,
    _validate_saml_avatar,
)
from sentry.auth.view import AuthView
from sentry.testutils.silo import control_silo_test

dummy_provider_config = {
    "attribute_mapping": {
        Attributes.IDENTIFIER: "id",
        Attributes.USER_EMAIL: "email",
        Attributes.FIRST_NAME: "first",
        Attributes.LAST_NAME: "last",
    }
}

dummy_provider_config_with_avatar = {
    "attribute_mapping": {
        **dummy_provider_config["attribute_mapping"],
        Attributes.AVATAR: "photo",
    }
}


def _png_b64() -> str:
    """Return base64-encoded bytes of a small valid PNG image."""
    buffer = BytesIO()
    Image.new("RGB", (10, 10), "blue").save(buffer, format="PNG")
    return b64encode(buffer.getvalue()).decode()


class DummySAML2Provider(SAML2Provider):
    name = "dummy"
    key = "dummy_saml2"

    def get_saml_setup_pipeline(self) -> list[AuthView]:
        raise NotImplementedError


@control_silo_test
class SAML2ProviderTest(TestCase):
    provider = DummySAML2Provider()

    def test_build_config_adds_attributes(self) -> None:
        config = self.provider.build_config({})

        assert "attribute_mapping" in config

    def test_build_config_with_provider_attributes(self) -> None:
        with mock.patch.object(self.provider, "attribute_mapping") as attribute_mapping:
            config = self.provider.build_config({})

            assert "attribute_mapping" in config
            assert config["attribute_mapping"] == attribute_mapping.return_value

    def test_build_identity_invalid(self) -> None:
        self.provider.config = dummy_provider_config
        state: dict[str, dict[str, Any]] = {"auth_attributes": {}}

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(state)

        state = {"auth_attributes": {"id": [""], "email": ["valid@example.com"]}}

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(state)

        state = {"auth_attributes": {"id": ["1234"], "email": [""]}}

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(state)

    def test_build_identity(self) -> None:
        self.provider.config = dummy_provider_config
        attrs = {
            "id": ["123"],
            "email": ["valid@example.com"],
            "first": ["Morty"],
            "last": ["Smith"],
        }

        state = {"auth_attributes": attrs}
        identity = self.provider.build_identity(state)

        assert identity["id"] == "123"
        assert identity["email"] == "valid@example.com"
        assert identity["name"] == "Morty Smith"

    def test_build_identity_empty_lastname(self) -> None:
        self.provider.config = dummy_provider_config
        attrs = {
            "id": ["123"],
            "email": ["valid@example.com"],
            "first": ["Morty"],
            "last": [],
        }

        state = {"auth_attributes": attrs}
        identity = self.provider.build_identity(state)

        assert identity["id"] == "123"
        assert identity["email"] == "valid@example.com"
        assert identity["name"] == "Morty"

    def test_build_identity_with_avatar(self) -> None:
        avatar = _png_b64()
        self.provider.config = dummy_provider_config_with_avatar
        state = {
            "auth_attributes": {
                "id": ["123"],
                "email": ["valid@example.com"],
                "first": ["Morty"],
                "last": ["Smith"],
                "photo": [avatar],
            }
        }

        identity = self.provider.build_identity(state)

        assert identity["avatar"] == avatar

    def test_build_identity_with_invalid_avatar_is_omitted(self) -> None:
        self.provider.config = dummy_provider_config_with_avatar
        state = {
            "auth_attributes": {
                "id": ["123"],
                "email": ["valid@example.com"],
                "photo": ["not-a-real-image"],
            }
        }

        identity = self.provider.build_identity(state)

        assert "avatar" not in identity

    def test_build_identity_without_avatar_mapping(self) -> None:
        self.provider.config = dummy_provider_config
        state = {"auth_attributes": {"id": ["123"], "email": ["valid@example.com"]}}

        identity = self.provider.build_identity(state)

        assert "avatar" not in identity


class ValidateSamlAvatarTest(TestCase):
    def test_valid_png(self) -> None:
        avatar = _png_b64()
        assert _validate_saml_avatar(avatar) == avatar

    def test_strips_data_uri_prefix(self) -> None:
        avatar = _png_b64()
        assert _validate_saml_avatar(f"data:image/png;base64,{avatar}") == avatar

    def test_rejects_non_image(self) -> None:
        assert _validate_saml_avatar(b64encode(b"this is not an image").decode()) is None

    def test_rejects_invalid_base64(self) -> None:
        assert _validate_saml_avatar("!!! not base64 !!!") is None

    def test_empty_or_missing(self) -> None:
        assert _validate_saml_avatar("") is None
        assert _validate_saml_avatar(None) is None
