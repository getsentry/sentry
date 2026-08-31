import pytest

from sentry.sentry_apps.utils.headers import (
    assert_http_header_value,
    parse_custom_headers,
    validate_http_headers,
)


class TestAssertHttpHeaderValue:
    def test_accepts_latin1(self) -> None:
        assert_http_header_value("Bearer token-with-å")

    def test_rejects_non_latin1(self) -> None:
        with pytest.raises(ValueError, match="non-latin-1"):
            # Ideographic space U+3000, same class of char as SENTRY-5TWJ.
            assert_http_header_value("Bearer　token")


class TestValidateHttpHeaders:
    def test_valid(self) -> None:
        validate_http_headers({"Authorization": "Bearer token"})

    def test_invalid_value(self) -> None:
        with pytest.raises(ValueError, match="header value"):
            validate_http_headers({"Authorization": "Bearer　token"})


class TestParseCustomHeaders:
    def test_parses_name_value(self) -> None:
        assert parse_custom_headers(["Authorization: Bearer token"]) == {
            "Authorization": "Bearer token"
        }
