# Snuba HTTP endpoint for inserting EAP items
EAP_ITEMS_INSERT_ENDPOINT = "/tests/entities/eap_items/insert_bytes"


def hex_to_item_id(hex_string: str) -> bytes:
    """
    Converts a 32-character hex string (e.g. event_id, span_id) to a
    16-byte EAP item_id in little-endian format (stored as a UInt128
    in ClickHouse).
    """

    return int(hex_string, 16).to_bytes(16, "little")


def item_id_to_hex(item_id: bytes) -> str:
    """
    Converts a 16-byte EAP item_id in little-endian format (stored as
    a UInt128 in ClickHouse) to a 32-character hex string.

    This is the inverse of hex_to_item_id() and is used when reading
    item_id from EAP and converting it back to the original identifier
    format.
    """

    return format(int.from_bytes(item_id, "little"), "032x")
