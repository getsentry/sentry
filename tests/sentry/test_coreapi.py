from __future__ import absolute_import
from collections import namedtuple

import mock
from sentry.coreapi import ClientApiHelper
from sentry.testutils import TestCase
from sentry.utils.data_filters import FilterStatKeys


class ClientApiHelperTestCase(TestCase):
    @mock.patch('sentry.coreapi.is_valid_error_message')
    def test_should_filter_message(self, mock_is_valid_error_message):

        TestItem = namedtuple('TestItem', 'value formatted result')

        helper = ClientApiHelper()

        items = [
            TestItem(
                {'type': 'UnfilteredException'},
                'UnfilteredException',
                True,
            ),
            TestItem(
                {'value': 'This is an unfiltered exception.'},
                'This is an unfiltered exception.',
                True,
            ),
            TestItem(
                {'type': 'UnfilteredException', 'value': 'This is an unfiltered exception.'},
                'UnfilteredException: This is an unfiltered exception.',
                True,
            ),
            TestItem(
                {'type': 'FilteredException', 'value': 'This is a filtered exception.'},
                'FilteredException: This is a filtered exception.',
                False,
            ),
        ]

        data = {
            'sentry.interfaces.Exception': {
                'values': [item.value for item in items]
            },
        }

        mock_is_valid_error_message.side_effect = [item.result for item in items]

        assert helper.should_filter(self.project, data) == (True, FilterStatKeys.ERROR_MESSAGE)

        assert mock_is_valid_error_message.call_args_list == [
            mock.call(self.project, item.formatted) for item in items]
