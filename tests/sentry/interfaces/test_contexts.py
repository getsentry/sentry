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
                'rooted': True,
            },
        })
        assert sorted(ctx.iter_tags()) == [
            ('os', 'Windows 95'),
            ('os.name', 'Windows'),
            ('os.rooted', 'yes'),
        ]
        assert ctx.to_json() == {
            'os': {
                'type': 'os',
                'name': 'Windows',
                'version': '95',
                'rooted': True,
            }
        }

    def test_os_normalization(self):
        ctx = Contexts.to_python({
            'os': {
                'raw_description': 'Microsoft Windows 6.1.7601 S'
            },
        })
        assert sorted(ctx.iter_tags()) == [
            ('os', 'Windows 6.1.7601'),
            ('os.name', 'Windows')
        ]
        assert ctx.to_json() == {
            'os': {
                'type': 'os',
                'raw_description': 'Microsoft Windows 6.1.7601 S',
                'name': 'Windows',
                'version': '6.1.7601'
            }
        }

    def test_runtime(self):
        ctx = Contexts.to_python(
            {
                'runtime': {
                    'name': 'Java',
                    'version': '1.2.3',
                    'build': 'BLAH',
                },
            }
        )
        assert sorted(ctx.iter_tags()) == [
            ('runtime', 'Java 1.2.3'),
            ('runtime.name', 'Java'),
        ]
        assert ctx.to_json() == {
            'runtime': {
                'type': 'runtime',
                'name': 'Java',
                'version': '1.2.3',
                'build': 'BLAH',
            }
        }

    def test_runtime_normalization(self):
        ctx = Contexts.to_python({
            'runtime': {
                'raw_description': '.NET Framework 4.0.30319.42000',
                'build': '461808',
            }
        })
        assert sorted(ctx.iter_tags()) == [
            ('runtime', '.NET Framework 4.7.2'),
            ('runtime.name', '.NET Framework')
        ]
        assert ctx.to_json() == {
            'runtime': {
                'type': 'runtime',
                'raw_description': '.NET Framework 4.0.30319.42000',
                'build': '461808',
                'name': '.NET Framework',
                'version': '4.7.2'
            }
        }

    def test_device(self):
        ctx = Contexts.to_python(
            {
                'device': {
                    'name': 'My iPad',
                    'model': 'iPad',
                    'model_id': '1234AB',
                    'version': '1.2.3',
                    'arch': 'arm64',
                },
            }
        )
        assert sorted(ctx.iter_tags()) == [
            ('device', 'iPad'),
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
        ctx = Contexts.to_python(
            {
                'my_device': {
                    'type': 'device',
                    'title': 'My Title',
                    'name': 'My iPad',
                    'model': 'iPad',
                    'model_id': '1234AB',
                    'version': '1.2.3',
                    'arch': 'arm64',
                },
            }
        )
        assert sorted(ctx.iter_tags()) == [('my_device', 'iPad')]
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
        ctx = Contexts.to_python(
            {
                'whatever': {
                    'foo': 'bar',
                    'blub': 'blah',
                    'biz': [1, 2, 3],
                    'baz': {
                        'foo': 'bar'
                    },
                },
            }
        )
        assert sorted(ctx.iter_tags()) == []
        assert ctx.to_json() == {
            'whatever': {
                'type': 'default',
                'foo': 'bar',
                'blub': 'blah',
                'biz': [1, 2, 3],
                'baz': {
                    'foo': 'bar'
                },
            }
        }

    def test_path(self):
        assert Contexts().get_path() == 'contexts'

    def test_app(self):
        ctx = Contexts.to_python({
            'app': {
                'app_id': '1234',
                'device_app_hash': '5678',
            },
        })
        assert sorted(ctx.iter_tags()) == [
            ('app.device', '5678'),
        ]
        assert ctx.to_json() == {
            'app': {
                'type': 'app',
                'app_id': '1234',
                'device_app_hash': '5678',
            }
        }
