# -*- coding: utf-8 -*-

from __future__ import absolute_import


from sentry.interfaces.contexts import Contexts
from sentry.testutils import TestCase


class ContextsTest(TestCase):

    def test_os(self):
        ctx = Contexts.to_python({
            'os': {
                'name': 'Windows',
                'version': '95',
            },
        })
        assert sorted(ctx.iter_tags()) == [
            ('os.name', 'Windows'),
            ('os.version', '95'),
        ]
        assert ctx.to_json() == {
            'os': {
                'type': 'os',
                'name': 'Windows',
                'version': '95',
            }
        }

    def test_runtime(self):
        ctx = Contexts.to_python({
            'runtime': {
                'name': 'Java',
                'version': '1.2.3',
                'build': 'BLAH',
            },
        })
        assert sorted(ctx.iter_tags()) == [
            ('runtime.build', 'BLAH'),
            ('runtime.name', 'Java'),
            ('runtime.version', '1.2.3'),
        ]
        assert ctx.to_json() == {
            'runtime': {
                'type': 'runtime',
                'name': 'Java',
                'version': '1.2.3',
                'build': 'BLAH',
            }
        }

    def test_device(self):
        ctx = Contexts.to_python({
            'device': {
                'name': 'My iPad',
                'model': 'iPad',
                'model_id': '1234AB',
                'version': '1.2.3',
                'arch': 'arm64',
            },
        })
        assert sorted(ctx.iter_tags()) == [
            ('device.arch', 'arm64'),
            ('device.model', 'iPad'),
            ('device.model_id', '1234AB'),
            ('device.name', 'My iPad'),
        ]
        assert ctx.to_json() == {
            'device': {
                'type': 'device',
                'name': 'My iPad',
                'model': 'iPad',
                'model_id': '1234AB',
                'version': '1.2.3',
                'arch': 'arm64',
            }
        }

    def test_device_with_alias(self):
        ctx = Contexts.to_python({
            'my_device': {
                'type': 'device',
                'title': 'My Title',
                'name': 'My iPad',
                'model': 'iPad',
                'model_id': '1234AB',
                'version': '1.2.3',
                'arch': 'arm64',
            },
        })
        assert sorted(ctx.iter_tags()) == [
            ('my_device.arch', 'arm64'),
            ('my_device.model', 'iPad'),
            ('my_device.model_id', '1234AB'),
            ('my_device.name', 'My iPad')
        ]
        assert ctx.to_json() == {
            'my_device': {
                'type': 'device',
                'title': 'My Title',
                'name': 'My iPad',
                'model': 'iPad',
                'model_id': '1234AB',
                'version': '1.2.3',
                'arch': 'arm64',
            }
        }

    def test_default(self):
        ctx = Contexts.to_python({
            'whatever': {
                'foo': 'bar',
                'blub': 'blah',
            },
        })
        assert sorted(ctx.iter_tags()) == []
        assert ctx.to_json() == {
            'whatever': {
                'type': 'default',
                'foo': 'bar',
                'blub': 'blah',
            }
        }

    def test_path(self):
        assert Contexts().get_path() == 'contexts'
