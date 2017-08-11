from __future__ import absolute_import

import pytest
import time

from sentry.digests import Record
from sentry.digests.backends.base import InvalidState
from sentry.digests.backends.redis import RedisBackend
from sentry.testutils import TestCase


class RedisBackendTestCase(TestCase):
    def test_basic(self):
        backend = RedisBackend()

        # The first item should return "true", indicating that this timeline
        # can be immediately dispatched to be digested.
        record_1 = Record('record:1', 'value', time.time())
        assert backend.add('timeline', record_1) is True

        # The second item should return "false", since it's ready to be
        # digested but dispatching again would cause it to be sent twice.
        record_2 = Record('record:2', 'value', time.time())
        assert backend.add('timeline', record_2) is False

        # There's nothing to move between sets, so scheduling should return nothing.
        assert set(backend.schedule(time.time())) == set()

        with backend.digest('timeline', 0) as records:
            assert set(records) == set([record_1, record_2])

        # The schedule should now contain the timeline.
        assert set(entry.key for entry in backend.schedule(time.time())) == set(['timeline'])

        # We didn't add any new records so there's nothing to do here.
        with backend.digest('timeline', 0) as records:
            assert set(records) == set([])

        # There's nothing to move between sets since the timeline contents no
        # longer exist at this point.
        assert set(backend.schedule(time.time())) == set()

    def test_truncation(self):
        backend = RedisBackend(capacity=2, truncation_chance=1.0)

        records = [Record('record:{}'.format(i), 'value', time.time()) for i in xrange(4)]
        for record in records:
            backend.add('timeline', record)

        with backend.digest('timeline', 0) as records:
            assert set(records) == set(records[-2:])

    def test_maintenance_failure_recovery(self):
        backend = RedisBackend()

        record_1 = Record('record:1', 'value', time.time())
        backend.add('timeline', record_1)

        try:
            with backend.digest('timeline', 0) as records:
                raise Exception('This causes the digest to not be closed.')
        except Exception:
            pass

        # Maintenance should move the timeline back to the waiting state, ...
        backend.maintenance(time.time())

        # ...and you can't send a digest in the waiting state.
        with pytest.raises(InvalidState):
            with backend.digest('timeline', 0) as records:
                pass

        record_2 = Record('record:2', 'value', time.time())
        backend.add('timeline', record_2)

        # The schedule should now contain the timeline.
        assert set(entry.key for entry in backend.schedule(time.time())) == set(['timeline'])

        # The existing and new record should be there because the timeline
        # contents were merged back into the digest.
        with backend.digest('timeline', 0) as records:
            assert set(records) == set([record_1, record_2])

    def test_delete(self):
        backend = RedisBackend()
        backend.add('timeline', Record('record:1', 'value', time.time()))
        backend.delete('timeline')

        with pytest.raises(InvalidState):
            with backend.digest('timeline', 0) as records:
                assert set(records) == set([])

        assert set(backend.schedule(time.time())) == set()
        assert len(backend._get_connection('timeline').keys('d:*')) == 0

    def test_missing_record_contents(self):
        backend = RedisBackend()

        record_1 = Record('record:1', 'value', time.time())
        backend.add('timeline', record_1)
        backend._get_connection('timeline').delete('d:t:timeline:r:record:1')

        record_2 = Record('record:2', 'value', time.time())
        backend.add('timeline', record_2)

        # The existing and new record should be there because the timeline
        # contents were merged back into the digest.
        with backend.digest('timeline', 0) as records:
            assert set(records) == set([record_2])
