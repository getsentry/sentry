# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.interfaces.debug_meta import DebugMeta
from sentry.testutils import TestCase


class DebugMetaTest(TestCase):
    def test_apple_behavior(self):
        image_name = (
            '/var/containers/Bundle/Application/'
            'B33C37A8-F933-4B6B-9FFA-152282BFDF13/SentryTest.app/SentryTest'
        )
        interface = DebugMeta.to_python(
            {
                "images": [
                    {
                        "type": "apple",
                        "cpu_subtype": 0,
                        "uuid": "C05B4DDD-69A7-3840-A649-32180D341587",
                        "image_vmaddr": 4294967296,
                        "image_addr": '0x100020000',
                        "cpu_type": 16777228,
                        "image_size": 32768,
                        "name": image_name,
                    }
                ],
                "sdk_info": {
                    "sdk_name": "iOS",
                    "version_major": 9,
                    "version_minor": 3,
                    "version_patchlevel": 0
                }
            }
        )

        assert len(interface.images) == 1
        assert interface.images[0] == {
            'type': 'apple',
            'cpu_type': 16777228,
            'cpu_subtype': 0,
            'uuid': 'c05b4ddd-69a7-3840-a649-32180d341587',
            'image_vmaddr': '0x100000000',
            'image_addr': '0x100020000',
            'image_size': 32768,
            'name': image_name,
        }
        assert interface.sdk_info == {
            'build': None,
            'dsym_type': 'none',
            'sdk_name': 'iOS',
            'version_major': 9,
            'version_minor': 3,
            'version_patchlevel': 0,
        }

    def test_apple_behavior_with_arch(self):
        image_name = (
            '/var/containers/Bundle/Application/'
            'B33C37A8-F933-4B6B-9FFA-152282BFDF13/SentryTest.app/SentryTest'
        )
        interface = DebugMeta.to_python(
            {
                "images": [
                    {
                        "type": "apple",
                        "arch": "x86_64",
                        "cpu_subtype": 0,
                        "uuid": "C05B4DDD-69A7-3840-A649-32180D341587",
                        "image_vmaddr": 4294967296,
                        "image_addr": '0x100020000',
                        "cpu_type": 16777228,
                        "image_size": 32768,
                        "name": image_name,
                    }
                ],
                "sdk_info": {
                    "sdk_name": "iOS",
                    "version_major": 9,
                    "version_minor": 3,
                    "version_patchlevel": 0
                }
            }
        )

        assert interface.images[0]['arch'] == 'x86_64'

    def test_symbolic_behavior(self):
        interface = DebugMeta.to_python(
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
                    "version_patchlevel": 14393
                }
            }
        )

        assert len(interface.images) == 1
        assert interface.images[0] == {
            'type': 'symbolic',
            'id': '3249d99d-0c40-4931-8610-f4e4fb0b6936-1',
            'image_vmaddr': '0x0',
            'image_addr': '0x2a0000',
            'image_size': 36864,
            'name': 'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe',
        }

        assert interface.sdk_info == {
            'build': None,
            'dsym_type': 'none',
            'sdk_name': 'Windows',
            'version_major': 10,
            'version_minor': 0,
            'version_patchlevel': 14393,
        }

    def test_symbolic_behavior_with_arch(self):
        interface = DebugMeta.to_python(
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
                    "version_patchlevel": 14393
                }
            }
        )

        assert interface.images[0]['arch'] == 'x86'

    def test_proguard_behavior(self):
        interface = DebugMeta.to_python(
            {
                "images": [{
                    "type": "proguard",
                    "uuid": "C05B4DDD-69A7-3840-A649-32180D341587",
                }]
            }
        )

        assert len(interface.images) == 1
        img = interface.images[0]
        assert img['type'] == 'proguard'
        assert img['uuid'] == 'c05b4ddd-69a7-3840-a649-32180d341587'
