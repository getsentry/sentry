# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture, around
from mock import patch

from sentry.models import Option
from sentry.options.manager import (
    OptionsManager, UnknownOption,
    FLAG_IMMUTABLE, FLAG_NOSTORE, FLAG_STOREONLY)
from sentry.testutils import TestCase


class OptionsManagerTest(TestCase):
    @fixture
    def manager(self):
        return OptionsManager()

    @around
    def register(self):
        self.manager.register('foo')
        yield
        self.manager.unregister('foo')

    def test_simple(self):
        assert self.manager.get('foo') == ''

        with self.settings(SENTRY_OPTIONS={'foo': 'bar'}):
            assert self.manager.get('foo') == 'bar'

        self.manager.set('foo', 'bar')

        assert self.manager.get('foo') == 'bar'

        self.manager.delete('foo')

        assert self.manager.get('foo') == ''

    def test_register(self):
        with self.assertRaises(UnknownOption):
            self.manager.get('does-not-exit')

        with self.assertRaises(UnknownOption):
            self.manager.set('does-not-exist', 'bar')

        self.manager.register('does-not-exist')
        self.manager.get('does-not-exist')  # Just shouldn't raise
        self.manager.unregister('does-not-exist')

        with self.assertRaises(UnknownOption):
            self.manager.get('does-not-exist')

        with self.assertRaises(AssertionError):
            # This key should already exist, and we can't re-register
            self.manager.register('foo')

        with self.assertRaises(TypeError):
            self.manager.register('wrong-type', default=1, type=basestring)

        with self.assertRaises(TypeError):
            self.manager.register('none-type', default=None, type=type(None))

    def test_legacy_key(self):
        """
        Allow sentry: prefixed keys without any registration
        """
        # These just shouldn't blow up since they are implicitly registered
        assert self.manager.get('sentry:foo') == ''
        self.manager.set('sentry:foo', 'bar')
        assert self.manager.get('sentry:foo') == 'bar'
        assert self.manager.delete('sentry:foo')
        assert self.manager.get('sentry:foo') == ''

    def test_types(self):
        self.manager.register('some-int', type=int, default=0)
        with self.assertRaises(TypeError):
            self.manager.set('some-int', 'foo')
        self.manager.set('some-int', 1)
        assert self.manager.get('some-int') == 1

    def test_default(self):
        self.manager.register('awesome', default='lol')
        assert self.manager.get('awesome') == 'lol'
        self.manager.set('awesome', 'bar')
        assert self.manager.get('awesome') == 'bar'
        self.manager.delete('awesome')
        assert self.manager.get('awesome') == 'lol'

    def test_flag_immutable(self):
        self.manager.register('immutable', flags=FLAG_IMMUTABLE)
        with self.assertRaises(AssertionError):
            self.manager.set('immutable', 'thing')
        with self.assertRaises(AssertionError):
            self.manager.delete('immutable')

    def test_flag_nostore(self):
        self.manager.register('nostore', flags=FLAG_NOSTORE)
        with self.assertRaises(AssertionError):
            self.manager.set('nostore', 'thing')

        # Make sure that we don't touch either of the stores
        with patch.object(self.manager.cache, 'get', side_effect=Exception()):
            with patch.object(Option.objects, 'get_queryset', side_effect=Exception()):
                assert self.manager.get('nostore') == ''

                with self.settings(SENTRY_OPTIONS={'nostore': 'foo'}):
                    assert self.manager.get('nostore') == 'foo'

        with self.assertRaises(AssertionError):
            self.manager.delete('nostore')

    def test_validate(self):
        with self.assertRaises(UnknownOption):
            self.manager.validate({'unknown': ''})

        self.manager.register('unknown')
        self.manager.register('storeonly', flags=FLAG_STOREONLY)
        self.manager.validate({'unknown': ''})

        with self.assertRaises(AssertionError):
            self.manager.validate({'storeonly': ''})

        with self.assertRaises(TypeError):
            self.manager.validate({'unknown': True})

    def test_flag_storeonly(self):
        self.manager.register('storeonly', flags=FLAG_STOREONLY)
        assert self.manager.get('storeonly') == ''

        with self.settings(SENTRY_OPTIONS={'storeonly': 'something-else!'}):
            assert self.manager.get('storeonly') == ''

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

    def test_unregister(self):
        with self.assertRaises(UnknownOption):
            self.manager.unregister('does-not-exist')
