import re
import uuid

from django.utils.encoding import force_str

INVALID_ID_DETAILS = "{} must be a valid UUID hex (32-36 characters long, containing only digits, dashes, or a-f characters)"

WILDCARD_NOT_ALLOWED = "Wildcard conditions are not permitted on `{}` field"

INVALID_SPAN_ID = "{} must be a valid 16 character hex (containing only digits, or a-f characters)"

HEXADECIMAL_16_DIGITS = re.compile("^[0-9a-fA-F]{16}$")


def normalize_event_id(value):
    try:
        return uuid.UUID(force_str(value)).hex
    except (TypeError, AttributeError, ValueError):
        return None


def is_event_id(value):
    return normalize_event_id(value) is not None


def is_span_id(value):
    return bool(HEXADECIMAL_16_DIGITS.search(force_str(value)))
