from __future__ import annotations

# Short codes historically sent by launchpad in lieu of a human-readable sentence.
# New reasons should be emitted as sentences upstream and will pass through unchanged.
_KNOWN_SHORT_CODES: dict[str, str] = {
    "invalid_signature": "The build's code signature could not be verified.",
    "simulator": "Simulator builds cannot be distributed.",
}


def normalize_installable_app_error_message(message: str | None) -> str | None:
    if message is None:
        return None
    return _KNOWN_SHORT_CODES.get(message, message)
