WORD_JOINER = "\u2060"

_CONTROL_CHAR_TABLE = str.maketrans(
    "", "", "".join(chr(c) for c in [*range(0x00, 0x09), 0x0B, 0x0C, *range(0x0E, 0x20), 0x7F])
)


def sanitize_outbound_name(value: str) -> str:
    """Prevent mail-client auto-linking of user-controlled display names
    by breaking periods, URL schemes, and stripping control characters."""
    value = value.translate(_CONTROL_CHAR_TABLE)
    value = value.replace("://", ":" + WORD_JOINER + "//")
    value = value.replace(".", WORD_JOINER + ".")
    return value
