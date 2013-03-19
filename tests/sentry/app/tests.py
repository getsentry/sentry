# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry import app
from sentry.testutils import TestCase


class AppTest(TestCase):
    def test_buffer_is_a_buffer(self):
        from sentry.buffer.base import Buffer
        self.assertEquals(type(app.buffer), Buffer)


class GetBufferTest(TestCase):
    @mock.patch('sentry.app.import_string')
    def test_instantiates_class_with_options(self, import_string):
        options = {'hello': 'world'}
        path = 'lol.FooBar'

        result = app.get_instance(path, options)

        import_string.assert_called_once_with(path)
        import_string.return_value.assert_called_once_with(**options)

        assert result == import_string.return_value.return_value
