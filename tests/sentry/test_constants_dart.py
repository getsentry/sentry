"""Tests for Dart-related constants."""


def test_dart_symbolmap_mime_type() -> None:
    """Test that dartsymbolmap MIME type is properly defined."""
    # Get the dictionary directly from the module
    import sentry.constants
    from sentry.constants import _get_all_extensions_from_mime_types

    mime_type_mapping = getattr(sentry.constants, "_mime_type_mapping", {})

    # Verify dartsymbolmap MIME type is in the mapping
    assert "application/x-dartsymbolmap+json" in mime_type_mapping
    assert mime_type_mapping["application/x-dartsymbolmap+json"] == "dartsymbolmap"

    # Verify the extension is included in all extensions
    all_extensions = _get_all_extensions_from_mime_types()
    assert "dartsymbolmap" in all_extensions
