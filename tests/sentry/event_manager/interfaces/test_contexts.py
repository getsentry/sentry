# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_ctx_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"contexts": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())
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
    make_ctx_snapshot({"os": {"name": "Windows", "version": "95", "rooted": True}})


def test_null_values(make_ctx_snapshot):
    make_ctx_snapshot({"os": None})


def test_null_values2(make_ctx_snapshot):
    make_ctx_snapshot({"os": {}})


def test_null_values3(make_ctx_snapshot):
    make_ctx_snapshot({"os": {"name": None}})


def test_os_normalization(make_ctx_snapshot):
    make_ctx_snapshot({"os": {"raw_description": "Microsoft Windows 6.1.7601 S"}})


def test_runtime(make_ctx_snapshot, insta_snapshot):
    make_ctx_snapshot({"runtime": {"name": "Java", "version": "1.2.3", "build": "BLAH"}})


def test_runtime_normalization(make_ctx_snapshot):
    make_ctx_snapshot(
        {"runtime": {"raw_description": ".NET Framework 4.0.30319.42000", "build": "461808"}}
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
