# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.applecrash import AppleCrashReport
from sentry.testutils import TestCase


class AppleCrashReportTest(TestCase):
    @fixture
    def interface(self):
        return AppleCrashReport.to_python(dict(
            crash={
                'diagnosis': 'Aha',
                'error': {},
                'threads': [],
            },
            binary_images=[
                {
                    "cpu_subtype": 9,
                    "cpu_type": 12,
                    "image_addr": 749568,
                    "image_size": 262144,
                    "image_vmaddr": 16384,
                    "name": (
                        '/private/var/mobile/Containers/Bundle/Application'
                        '/436352A9-1BE2-4934-9C6F-237CC7DFF27B'
                        '/Crash-Tester.app/Crash-Tester'
                    ),
                    "uuid": "8094558B-3641-36F7-BA80-A1AAABCF72DA"
                }
            ],
        ))

    def test_path(self):
        assert self.interface.get_path() == 'sentry.interfaces.AppleCrashReport'

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()

    def test_empty_hash(self):
        assert self.interface.get_hash() == []
