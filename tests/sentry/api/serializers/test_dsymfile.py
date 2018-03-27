# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.api.serializers import serialize
from sentry.testutils import TestCase


class DSymFileSerializerTest(TestCase):
    def test_simple(self):
        file = self.create_file(
            name='baz.dSYM',
            size=42,
            headers={'Content-Type': 'application/x-mach-binary'},
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
        )

        dsym_file = self.create_dsym_file(
            debug_id='dfb8e43a-f242-3d73-a453-aeb6a777ef75',
            object_name='baz.dSYM',
            cpu_name='x86_64',
            file=file,
        )

        result = serialize(dsym_file)
        result.pop('id')
        result.pop('dateCreated')

        assert result == {
            'uuid': 'dfb8e43a-f242-3d73-a453-aeb6a777ef75',
            'debugId': 'dfb8e43a-f242-3d73-a453-aeb6a777ef75',
            'cpuName': 'x86_64',
            'objectName': 'baz.dSYM',
            'symbolType': 'macho',
            'size': 42,
            'sha1': 'dc1e3f3e411979d336c3057cce64294f3420f93a',
            'headers': {'Content-Type': 'application/x-mach-binary'},
        }

    def test_long_debug_id(self):
        file = self.create_file(
            name='baz.dSYM',
            size=42,
            headers={'Content-Type': 'application/x-mach-binary'},
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
        )

        dsym_file = self.create_dsym_file(
            debug_id='dfb8e43a-f242-3d73-a453-aeb6a777ef75-feedface',
            object_name='baz.dSYM',
            cpu_name='x86_64',
            file=file,
        )

        result = serialize(dsym_file)
        result.pop('id')
        result.pop('dateCreated')

        assert result == {
            'uuid': 'dfb8e43a-f242-3d73-a453-aeb6a777ef75',
            'debugId': 'dfb8e43a-f242-3d73-a453-aeb6a777ef75-feedface',
            'cpuName': 'x86_64',
            'objectName': 'baz.dSYM',
            'symbolType': 'macho',
            'size': 42,
            'sha1': 'dc1e3f3e411979d336c3057cce64294f3420f93a',
            'headers': {'Content-Type': 'application/x-mach-binary'},
        }
