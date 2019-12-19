# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_debug_meta_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"debug_meta": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())
        interface = evt.interfaces.get("debug_meta")
        insta_snapshot(
            {"errors": evt.data.get("errors"), "to_json": interface and interface.to_json()}
        )

    return inner


@pytest.mark.parametrize(
    "input",
    [
        {},
        {"images": None},
        # TODO(markus): Should eventually generate {"images": [None]}
        {"images": [None]},
    ],
)
def test_null_values(make_debug_meta_snapshot, input):
    make_debug_meta_snapshot(input)


def test_apple_behavior(make_debug_meta_snapshot):
    image_name = (
        "/var/containers/Bundle/Application/"
        "B33C37A8-F933-4B6B-9FFA-152282BFDF13/SentryTest.app/SentryTest"
    )
    make_debug_meta_snapshot(
        {
            "images": [
                {
                    "type": "apple",
                    "cpu_subtype": 0,
                    "uuid": "C05B4DDD-69A7-3840-A649-32180D341587",
                    "image_vmaddr": 4294967296,
                    "image_addr": "0x100020000",
                    "cpu_type": 16777228,
                    "image_size": 32768,
                    "name": image_name,
                }
            ],
            "sdk_info": {
                "sdk_name": "iOS",
                "version_major": 9,
                "version_minor": 3,
                "version_patchlevel": 0,
            },
        }
    )


def test_apple_behavior_with_arch(make_debug_meta_snapshot):
    image_name = (
        "/var/containers/Bundle/Application/"
        "B33C37A8-F933-4B6B-9FFA-152282BFDF13/SentryTest.app/SentryTest"
    )
    make_debug_meta_snapshot(
        {
            "images": [
                {
                    "type": "apple",
                    "arch": "x86_64",
                    "cpu_subtype": 0,
                    "uuid": "C05B4DDD-69A7-3840-A649-32180D341587",
                    "image_vmaddr": 4294967296,
                    "image_addr": "0x100020000",
                    "cpu_type": 16777228,
                    "image_size": 32768,
                    "name": image_name,
                }
            ],
            "sdk_info": {
                "sdk_name": "iOS",
                "version_major": 9,
                "version_minor": 3,
                "version_patchlevel": 0,
            },
        }
    )


def test_symbolic_behavior(make_debug_meta_snapshot):
    make_debug_meta_snapshot(
        {
            "images": [
                {
                    "type": "symbolic",
                    "id": "3249d99d-0c40-4931-8610-f4e4fb0b6936-1",
                    "image_addr": 2752512,
                    "image_size": 36864,
                    "name": "C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe",
                }
            ],
            "sdk_info": {
                "sdk_name": "Windows",
                "version_major": 10,
                "version_minor": 0,
                "version_patchlevel": 14393,
            },
        }
    )


def test_symbolic_behavior_with_arch(make_debug_meta_snapshot):
    make_debug_meta_snapshot(
        {
            "images": [
                {
                    "type": "symbolic",
                    "arch": "x86",
                    "id": "3249d99d-0c40-4931-8610-f4e4fb0b6936-1",
                    "image_addr": 2752512,
                    "image_size": 36864,
                    "name": "C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe",
                }
            ],
            "sdk_info": {
                "sdk_name": "Windows",
                "version_major": 10,
                "version_minor": 0,
                "version_patchlevel": 14393,
            },
        }
    )


def test_proguard_behavior(make_debug_meta_snapshot):
    make_debug_meta_snapshot(
        {"images": [{"type": "proguard", "uuid": "C05B4DDD-69A7-3840-A649-32180D341587"}]}
    )
