import copy

from sentry.eventstore.compressor import assemble, deduplicate


def _assert_roundtrip(data, assert_extra_keys=None):
    new_data, extra_keys = deduplicate(copy.deepcopy(data))

    if assert_extra_keys is not None:
        assert extra_keys == assert_extra_keys

    def get_extra_keys(checksums):
        assert set(checksums) == set(extra_keys)
        return extra_keys

    new_new_data = assemble(copy.deepcopy(new_data), get_extra_keys)

    assert new_new_data == data


def test_basic():
    assert deduplicate({}) == ({}, {})

    _assert_roundtrip({})
    _assert_roundtrip({"debug_meta": {}})
    _assert_roundtrip({"debug_meta": None})
    _assert_roundtrip({"debug_meta": {"images": []}})
    _assert_roundtrip({"debug_meta": {"images": None}})
    _assert_roundtrip({"debug_meta": {"images": [{}]}})

    checksum = "1a3e017bec533f3f4e59e44a3f53784e"
    _assert_roundtrip(
        {
            "debug_meta": {
                "images": [
                    {
                        "image_addr": "0xdeadbeef",
                        "debug_file": "C:/Ding/bla.pdb",
                        "code_file": "C:/Ding/bla.exe",
                        "debug_id": "1234abcdef",
                        "code_id": "1234abcdefgggg",
                    }
                ]
            }
        },
        assert_extra_keys={
            checksum: {
                "code_file": ["C:/Ding/bla.exe"],
                "code_id": ["1234abcdefgggg"],
                "debug_file": ["C:/Ding/bla.pdb"],
                "debug_id": ["1234abcdef"],
            }
        },
    )
