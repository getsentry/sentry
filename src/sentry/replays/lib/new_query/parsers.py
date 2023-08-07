import uuid


def parse_float(value: str) -> float:
    """Coerce to float or fail."""
    try:
        return float(value)
    except ValueError:
        raise Exception("Failed to parse float.")


def parse_int(value: str) -> int:
    """Coerce to int or fail."""
    try:
        return int(value)
    except ValueError:
        raise Exception("Failed to parse integer.")


def parse_str(value: str) -> str:
    """Coerce to str or fail."""
    return value


def parse_uuid(value: str) -> str:
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise Exception("Failed to parse UUID.")
