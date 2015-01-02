# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture
from mock import patch

from sentry.models import Option
from sentry.options.manager import OptionsManager
from sentry.testutils import TestCase


class OptionsManagerTest(TestCase):
    @fixture
    def manager(self):
        return OptionsManager()

    def test_simple(self):
        assert self.manager.get('foo') == ''

        with self.settings(SENTRY_OPTIONS={'foo': 'bar'}):
            assert self.manager.get('foo') == 'bar'

        self.manager.set('foo', 'bar')

        assert self.manager.get('foo') == 'bar'

        self.manager.delete('foo')

        assert self.manager.get('foo') == ''

    def test_db_unavailable(self):
        with patch.object(Option.objects, 'get_queryset', side_effect=Exception()):
            # we can't update options if the db is unavailable
            with self.assertRaises(Exception):
                self.manager.set('foo', 'bar')

        self.manager.set('foo', 'bar')

        with patch.object(Option.objects, 'get_queryset', side_effect=Exception()):
            assert self.manager.get('foo') == 'bar'

            with patch.object(self.manager.cache, 'get', side_effect=Exception()):
                assert self.manager.get('foo') == ''

                with patch.object(self.manager.cache, 'set', side_effect=Exception()):
                    assert self.manager.get('foo') == ''

    def test_db_and_cache_unavailable(self):
        self.manager.set('foo', 'bar')

        with self.settings(SENTRY_OPTIONS={'foo': 'baz'}):
            with patch.object(Option.objects, 'get_queryset', side_effect=Exception()):
                with patch.object(self.manager.cache, 'get', side_effect=Exception()):
                    assert self.manager.get('foo') == 'baz'

                    with patch.object(self.manager.cache, 'set', side_effect=Exception()):
                        assert self.manager.get('foo') == 'baz'

    def test_cache_unavailable(self):
        self.manager.set('foo', 'bar')

        with patch.object(self.manager.cache, 'get', side_effect=Exception()):
            assert self.manager.get('foo') == 'bar'

            with patch.object(self.manager.cache, 'set', side_effect=Exception()):
                assert self.manager.get('foo') == 'bar'

                # we should still be able to write a new value
                self.manager.set('foo', 'baz')

        # the cache should be incorrect now, but sync_options will eventually
        # correct the state
        assert self.manager.get('foo') == 'bar'

        # when the cache poofs, the db will be return the most-true answer
        with patch.object(self.manager.cache, 'get', side_effect=Exception()):
            assert self.manager.get('foo') == 'baz'

            with patch.object(self.manager.cache, 'set', side_effect=Exception()):
                assert self.manager.get('foo') == 'baz'
