import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_ctx_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"contexts": data})
        mgr.normalize()
        evt = eventstore.backend.create_event(project_id=1, data=mgr.get_data())
        interface = evt.interfaces.get("contexts")

        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": interface.to_json(),
                "tags": sorted(interface.iter_tags()),
            }
        )

    return inner


def test_os(make_ctx_snapshot):
    make_ctx_snapshot(
        {"os": {"os": "Windows 95", "name": "Windows", "version": "95", "rooted": True}}
    )


def test_null_values(make_ctx_snapshot):
    make_ctx_snapshot({"os": None})


def test_null_values2(make_ctx_snapshot):
    make_ctx_snapshot({"os": {}})


def test_null_values3(make_ctx_snapshot):
    make_ctx_snapshot({"os": {"name": None}})


def test_os_normalization(make_ctx_snapshot):
    make_ctx_snapshot({"os": {"raw_description": "Microsoft Windows 6.1.7601 S"}})


def test_runtime(make_ctx_snapshot):
    make_ctx_snapshot(
        {"runtime": {"runtime": "Java 1.2.3", "name": "Java", "version": "1.2.3", "build": "BLAH"}}
    )


def test_runtime_normalization(make_ctx_snapshot):
    make_ctx_snapshot(
        {"runtime": {"raw_description": ".NET Framework 4.0.30319.42000", "build": "461808"}}
    )


def test_browser(make_ctx_snapshot):
    make_ctx_snapshot(
        {"browser": {"browser": "Chrome 132.0.6834.0", "name": "Chrome", "version": "132.0.6834.0"}}
    )


def test_device(make_ctx_snapshot):
    make_ctx_snapshot(
        {
            "device": {
                "name": "My iPad",
                "model": "iPad",
                "model_id": "1234AB",
                "version": "1.2.3",
                "arch": "arm64",
            }
        }
    )


def test_device_with_alias(make_ctx_snapshot):
    make_ctx_snapshot(
        {
            "my_device": {
                "type": "device",
                "title": "My Title",
                "name": "My iPad",
                "model": "iPad",
                "model_id": "1234AB",
                "version": "1.2.3",
                "arch": "arm64",
            }
        }
    )


def test_default(make_ctx_snapshot):
    make_ctx_snapshot(
        {"whatever": {"foo": "bar", "blub": "blah", "biz": [1, 2, 3], "baz": {"foo": "bar"}}}
    )


def test_app(make_ctx_snapshot):
    make_ctx_snapshot({"app": {"app_id": "1234", "device_app_hash": "5678"}})


def test_gpu(make_ctx_snapshot):
    make_ctx_snapshot(
        {"gpu": {"name": "AMD Radeon Pro 560", "vendor_name": "Apple", "version": "Metal"}}
    )


def test_large_numbers():
    data = {
        "large_numbers": {
            "decimal_number": 123456.789,
            "number": 123456789,
            "negative_number": -123456789,
            "big_decimal_number": 123456789.123456789,
            "big_number": 123456789123456789,
            "big_negative_number": -123456789123456789,
        }
    }
    numeric_keys = {"decimal_number", "number", "negative_number"}
    string_keys = {"big_decimal_number", "big_number", "big_negative_number"}

    mgr = EventManager(data={"contexts": data})
    mgr.normalize()
    evt = eventstore.backend.create_event(project_id=1, data=mgr.get_data())
    interface = evt.interfaces.get("contexts")
    ctx_data = interface.to_json()["large_numbers"]
    for key in numeric_keys:
        assert isinstance(ctx_data[key], (int, float))
    for key in string_keys:
        assert isinstance(ctx_data[key], str)


def test_large_nested_numbers():
    data = {
        "large_numbers": {
            "dictionary": {"key_1": 608548899684111178, "key_2": -123456789123456789},
            "nested_dictionary": {
                "key_1": {"key_2": -123456789123456789, "key_3": 1},
                "key_4": 123456789.1234567,
            },
            "tuple": tuple((608548899684111178, 123456.789)),
            "nested_tuple": ((608548899684111178, "value"), (1, -123456789123456789)),
            "list": [1, 608548899684111178],
            "nested_list": [[1, 608548899684111178], -123456789123456789],
            "mixed_nesting": [
                (1, 608548899684111178),
                -123456789123456789,
                "something",
                {"key_1": 123456789.1234567, "key_2": [-123456789123456789, "value"]},
            ],
        }
    }

    mgr = EventManager(data={"contexts": data})
    mgr.normalize()
    evt = eventstore.backend.create_event(project_id=1, data=mgr.get_data())
    interface = evt.interfaces.get("contexts")
    ctx_data = interface.to_json()["large_numbers"]

    expected_data = {
        "dictionary": {"key_1": "608548899684111178", "key_2": "-123456789123456789"},
        "nested_dictionary": {
            "key_1": {"key_2": "-123456789123456789", "key_3": 1},
            "key_4": "123456789.1234567",
        },
        "tuple": ["608548899684111178", 123456.789],
        "nested_tuple": [["608548899684111178", "value"], [1, "-123456789123456789"]],
        "list": [1, "608548899684111178"],
        "nested_list": [[1, "608548899684111178"], "-123456789123456789"],
        "mixed_nesting": [
            [1, "608548899684111178"],
            "-123456789123456789",
            "something",
            {"key_1": "123456789.1234567", "key_2": ["-123456789123456789", "value"]},
        ],
        "type": "default",
    }
    assert ctx_data == expected_data
