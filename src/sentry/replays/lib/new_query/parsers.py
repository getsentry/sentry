import uuid


def parse_float(value: str) -> float:
    """Coerce to float or fail."""
    try:
        return float(value)
    except ValueError:
        raise Exception("Failed to parse float.")


def parse_int(value: str) -> int:
    """Coerce to int or fail."""
    return int(parse_float(value))


def parse_str(value: str) -> str:
    """Coerce to str or fail."""
    return value


def parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise Exception("Failed to parse UUID.")
