from __future__ import annotations

from base64 import b64decode, b64encode
from io import BytesIO
from typing import Any
from unittest import TestCase, mock

import pytest
from PIL import Image

from sentry.api.fields.avatar import MAX_DIMENSION
from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.saml2.forms import AttributeMappingForm
from sentry.auth.providers.saml2.provider import (
    Attributes,
    SAML2Provider,
    _extract_saml_avatar,
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
        # The avatar is validated + re-encoded at ACS time and bound under the
        # dedicated ``saml_avatar`` state key; build_identity just reads it.
        avatar = _validate_saml_avatar(_png_b64())
        self.provider.config = dummy_provider_config_with_avatar
        state = {
            "auth_attributes": {
                "id": ["123"],
                "email": ["valid@example.com"],
                "first": ["Morty"],
                "last": ["Smith"],
            },
            "saml_avatar": avatar,
        }

        identity = self.provider.build_identity(state)

        assert identity["avatar"] == avatar

    def test_build_identity_without_avatar_state_is_omitted(self) -> None:
        self.provider.config = dummy_provider_config_with_avatar
        state = {
            "auth_attributes": {
                "id": ["123"],
                "email": ["valid@example.com"],
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
        result = _validate_saml_avatar(_png_b64())

        assert result is not None
        with Image.open(BytesIO(b64decode(result))) as image:
            assert image.format == "PNG"

    def test_strips_data_uri_prefix(self) -> None:
        avatar = _png_b64()

        # The re-encoded output is deterministic, so the prefixed and bare inputs
        # must validate to the same stored payload.
        assert _validate_saml_avatar(f"data:image/png;base64,{avatar}") == _validate_saml_avatar(
            avatar
        )

    def test_reencodes_jpeg_to_png_and_strips_metadata(self) -> None:
        exif = Image.Exif()
        exif[0x010E] = "sensitive description"  # ImageDescription tag
        buffer = BytesIO()
        Image.new("RGB", (10, 10), "blue").save(buffer, format="JPEG", exif=exif)

        result = _validate_saml_avatar(b64encode(buffer.getvalue()).decode())

        assert result is not None
        with Image.open(BytesIO(b64decode(result))) as image:
            # Always stored as PNG to match the served filename/content type.
            assert image.format == "PNG"
            assert not dict(image.getexif())

    def test_crops_non_square_to_square(self) -> None:
        buffer = BytesIO()
        Image.new("RGB", (20, 10), "blue").save(buffer, format="PNG")

        result = _validate_saml_avatar(b64encode(buffer.getvalue()).decode())

        assert result is not None
        with Image.open(BytesIO(b64decode(result))) as image:
            assert image.size == (10, 10)

    def test_downscales_oversized_image(self) -> None:
        buffer = BytesIO()
        Image.new("RGB", (2000, 2000), "blue").save(buffer, format="PNG")

        result = _validate_saml_avatar(b64encode(buffer.getvalue()).decode())

        assert result is not None
        with Image.open(BytesIO(b64decode(result))) as image:
            assert image.size == (MAX_DIMENSION, MAX_DIMENSION)

    def test_applies_exif_orientation(self) -> None:
        # A 64x64 image split into 4 solid quadrants with Orientation=6 (rotate
        # 90 CW on display), stored as JPEG (universal EXIF orientation support).
        # Validation must bake the rotation into the pixels and drop the tag.
        source = Image.new("RGB", (64, 64))
        source.paste((255, 0, 0), (0, 0, 32, 32))  # top-left, red
        source.paste((0, 255, 0), (32, 0, 64, 32))  # top-right, green
        source.paste((0, 0, 255), (0, 32, 32, 64))  # bottom-left, blue
        source.paste((255, 255, 0), (32, 32, 64, 64))  # bottom-right, yellow
        exif = source.getexif()
        exif[0x0112] = 6  # Orientation
        buffer = BytesIO()
        source.save(buffer, format="JPEG", exif=exif.tobytes())

        result = _validate_saml_avatar(b64encode(buffer.getvalue()).decode())

        assert result is not None
        with Image.open(BytesIO(b64decode(result))) as image:
            # After a 90 CW rotation the original top-left quadrant lands
            # top-right; sample its interior (tolerant of JPEG artifacts).
            r, g, b = image.convert("RGB").getpixel((48, 16))
            assert r > 200 and g < 60 and b < 60
            assert not image.getexif().get(0x0112)

    def test_rejects_non_image(self) -> None:
        assert _validate_saml_avatar(b64encode(b"this is not an image").decode()) is None

    def test_rejects_invalid_base64(self) -> None:
        assert _validate_saml_avatar("!!! not base64 !!!") is None

    def test_empty_or_missing(self) -> None:
        assert _validate_saml_avatar("") is None
        assert _validate_saml_avatar(None) is None

    def test_does_not_raise_on_unexpected_pillow_error(self) -> None:
        # Pillow can raise non-OSError errors (e.g. DecompressionBombError) on
        # hostile data; validation must drop the avatar rather than propagate.
        avatar = _png_b64()
        with mock.patch(
            "sentry.auth.providers.saml2.provider.Image.open",
            side_effect=Image.DecompressionBombError("boom"),
        ):
            assert _validate_saml_avatar(avatar) is None


class ExtractSamlAvatarTest(TestCase):
    def test_validates_and_pops_mapped_avatar(self) -> None:
        attributes = {"id": ["123"], "photo": [_png_b64()]}

        result = _extract_saml_avatar(dummy_provider_config_with_avatar, attributes)

        assert result == _validate_saml_avatar(_png_b64())
        # Raw payload is removed so it never lands in the pipeline state.
        assert "photo" not in attributes

    def test_invalid_avatar_returns_none_but_still_pops(self) -> None:
        attributes = {"photo": ["not-a-real-image"]}

        assert _extract_saml_avatar(dummy_provider_config_with_avatar, attributes) is None
        assert "photo" not in attributes

    def test_returns_none_when_unmapped(self) -> None:
        attributes = {"photo": [_png_b64()]}

        assert _extract_saml_avatar(dummy_provider_config, attributes) is None
        # Untouched when the avatar attribute isn't mapped.
        assert "photo" in attributes

    def test_returns_none_when_attribute_absent(self) -> None:
        assert _extract_saml_avatar(dummy_provider_config_with_avatar, {"id": ["123"]}) is None

    def test_does_not_pop_key_shared_with_required_claim(self) -> None:
        # If the avatar maps to the same IdP key as a required claim, popping it
        # would blank that claim and break login, so the key must be retained.
        config = {
            "attribute_mapping": {
                Attributes.IDENTIFIER: "shared",
                Attributes.USER_EMAIL: "email",
                Attributes.AVATAR: "shared",
            }
        }
        attributes = {"shared": [_png_b64()], "email": ["user@example.com"]}

        result = _extract_saml_avatar(config, attributes)

        assert result == _validate_saml_avatar(_png_b64())
        assert "shared" in attributes


class AttributeMappingFormTest(TestCase):
    def test_exposes_and_preserves_avatar_mapping(self) -> None:
        # The configure view saves attribute_mapping straight from cleaned_data,
        # so the avatar key must be a form field or it gets dropped on save.
        form = AttributeMappingForm(
            {
                "identifier": "user_id",
                "user_email": "email",
                "first_name": "first",
                "last_name": "last",
                "avatar": "photo",
            }
        )

        assert form.is_valid(), form.errors
        assert form.cleaned_data[Attributes.AVATAR] == "photo"

    def test_avatar_mapping_is_optional(self) -> None:
        form = AttributeMappingForm({"identifier": "user_id", "user_email": "email"})

        assert form.is_valid(), form.errors
        assert form.cleaned_data[Attributes.AVATAR] == ""
