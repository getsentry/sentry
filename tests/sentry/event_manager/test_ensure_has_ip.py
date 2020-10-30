from __future__ import absolute_import

from sentry.event_manager import EventManager


def validate_and_normalize(report, client_ip=None):
    manager = EventManager(report, client_ip=client_ip)
    manager.normalize()
    return manager.get_data()


def test_with_remote_addr():
    inp = {"request": {"url": "http://example.com/", "env": {"REMOTE_ADDR": "192.168.0.1"}}}
    out = validate_and_normalize(inp, client_ip="127.0.0.1")
    assert out["request"]["env"]["REMOTE_ADDR"] == "192.168.0.1"


def test_with_user_ip():
    inp = {"user": {"ip_address": "192.168.0.1"}}
    out = validate_and_normalize(inp, client_ip="127.0.0.1")
    assert out["user"]["ip_address"] == "192.168.0.1"


def test_with_user_auto_ip():
    inp = {"user": {"ip_address": "{{auto}}"}}
    out = validate_and_normalize(inp, client_ip="127.0.0.1")
    assert out["user"]["ip_address"] == "127.0.0.1"

    inp = {"user": {"ip_address": "{{auto}}"}}
    out = validate_and_normalize(inp, client_ip="127.0.0.1")
    assert out["user"]["ip_address"] == "127.0.0.1"


def test_without_ip_values():
    inp = {
        "platform": "javascript",
        "user": {},
        "request": {"url": "http://example.com/", "env": {}},
    }
    out = validate_and_normalize(inp, client_ip="127.0.0.1")
    assert out["user"]["ip_address"] == "127.0.0.1"


def test_without_any_values():
    inp = {"platform": "javascript"}
    out = validate_and_normalize(inp, client_ip="127.0.0.1")
    assert out["user"]["ip_address"] == "127.0.0.1"


def test_with_http_auto_ip():
    inp = {"request": {"url": "http://example.com/", "env": {"REMOTE_ADDR": "{{auto}}"}}}
    out = validate_and_normalize(inp, client_ip="127.0.0.1")
    assert out["request"]["env"]["REMOTE_ADDR"] == "127.0.0.1"


def test_with_all_auto_ip():
    inp = {
        "user": {"ip_address": "{{auto}}"},
        "request": {"url": "http://example.com/", "env": {"REMOTE_ADDR": "{{auto}}"}},
    }
    out = validate_and_normalize(inp, client_ip="127.0.0.1")
    assert out["request"]["env"]["REMOTE_ADDR"] == "127.0.0.1"
    assert out["user"]["ip_address"] == "127.0.0.1"
