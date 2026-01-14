from sentry.utils.eap import hex_to_item_id, item_id_to_hex


def test_hex_to_item_id_basic():
    hex_string = "0fe53e4887e143549dd0cc65c0370d38"
    item_id = hex_to_item_id(hex_string)

    assert len(item_id) == 16
    assert isinstance(item_id, bytes)


def test_item_id_to_hex_basic():
    hex_string = "0fe53e4887e143549dd0cc65c0370d38"
    item_id = hex_to_item_id(hex_string)

    recovered = item_id_to_hex(item_id)

    assert recovered == hex_string
    assert len(recovered) == 32


def test_round_trip_conversion():
    test_ids = [
        "0fe53e4887e143549dd0cc65c0370d38",
        "b87e618e18dc428b9dbd9afc56c9e4cd",
        "00000000000000000000000000000000",
        "ffffffffffffffffffffffffffffffff",
        "0123456789abcdef0123456789abcdef",
        "fedcba9876543210fedcba9876543210",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "12345678123456781234567812345678",
    ]

    for original in test_ids:
        item_id = hex_to_item_id(original)
        recovered = item_id_to_hex(item_id)
        assert (
            recovered == original
        ), f"Round-trip conversion failed for {original}: got {recovered}"


def test_hex_to_item_id_is_little_endian():
    hex_string = "b402030405060708090a0b0c0d0e0f7a"
    item_id = hex_to_item_id(hex_string)

    assert item_id[0] == 0x7A
    assert item_id[15] == 0xB4
