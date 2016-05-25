from __future__ import absolute_import

import logging

from mock import patch

from sentry.testutils import TestCase


@patch('logging.StreamHandler.emit')
class TuringHandlerTestCase(TestCase):
    def test_human_formatting(self, mock_emit):
        with self.options({'system.logging-format': 'human'}):
            logger = logging.getLogger('sentry.audit')
            logger.setLevel(logging.INFO)
            logger.info(
                'My {drink} brings all the {people} to the {place}.',
                {'drink': 'milkshake', 'people': 'boys', 'place': 'yard'}
            )
            assert mock_emit.called
            record = mock_emit.call_args[0][0]
            assert record.msg == 'My milkshake brings all the boys to the yard.'

    def test_machine_formatting(self, mock_emit):
        with self.options({'system.logging-format': 'machine'}):
            logger = logging.getLogger('sentry.audit')
            logger.setLevel(logging.INFO)
            logger.info({
                'best_int_ever': 420,
                'long_id': 1L,
                'unicode': u'uni',
                'bits': [0, 1],
                'map': {'a': 'place'},
            })
            assert mock_emit.called
            record = mock_emit.call_args[0][0]
            encoded_record = {
                'best_int_ever': 420,
                'long_id': '1',
                'unicode': 'uni',
                'bits': '[0, 1]',
                'map': "{'a': 'place'}",
                'levelname': 'INFO',
                'loggername': 'sentry.audit',
            }
            assert record.msg == encoded_record
