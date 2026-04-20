from sentry.preprod.distribution_errors import normalize_installable_app_error_message


def test_normalizes_invalid_signature() -> None:
    assert (
        normalize_installable_app_error_message("invalid_signature")
        == "The build's code signature could not be verified."
    )


def test_normalizes_simulator() -> None:
    assert (
        normalize_installable_app_error_message("simulator")
        == "Simulator builds cannot be distributed."
    )


def test_passes_unknown_message_through() -> None:
    assert normalize_installable_app_error_message("Unsupported artifact type") == (
        "Unsupported artifact type"
    )


def test_passes_none_through() -> None:
    assert normalize_installable_app_error_message(None) is None


def test_idempotent_on_already_normalized_message() -> None:
    sentence = "The build's code signature could not be verified."
    assert normalize_installable_app_error_message(sentence) == sentence
