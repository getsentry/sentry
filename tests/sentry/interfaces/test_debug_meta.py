# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.interfaces.debug_meta import DebugMeta
from sentry.testutils import TestCase


class DebugMetaTest(TestCase):

    def test_basic_behavior(self):
        image_name = (
            '/var/containers/Bundle/Application/'
            'B33C37A8-F933-4B6B-9FFA-152282BFDF13/SentryTest.app/SentryTest'
        )
        interface = DebugMeta.to_python({
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
                "dsym_type": "macho",
                "sdk_name": "iOS",
                "version_major": 9,
                "version_minor": 3,
                "version_patchlevel": 0
            }
        })

        assert len(interface.images) == 1
        img = interface.images[0]
        assert img['type'] == 'apple'
        assert img['cpu_type'] == 16777228
        assert img['cpu_subtype'] == 0
        assert img['uuid'] == 'C05B4DDD-69A7-3840-A649-32180D341587'
        assert img['image_vmaddr'] == '0x100000000'
        assert img['image_addr'] == '0x100020000'
        assert img['image_size'] == 32768
        assert img['name'] == image_name

        assert interface.sdk_info['dsym_type'] == 'macho'
        assert interface.sdk_info['sdk_name'] == 'iOS'
        assert interface.sdk_info['version_major'] == 9
        assert interface.sdk_info['version_minor'] == 3
        assert interface.sdk_info['version_patchlevel'] == 0
