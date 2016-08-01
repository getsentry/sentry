from __future__ import absolute_import

import pytest

from exam import fixture

from sentry.testutils import TestCase
from sentry.utils.locking.backends.redis import RedisLockBackend
from sentry.utils.redis import clusters


class RedisLockBackendTestCase(TestCase):
    @fixture
    def cluster(self):
        return clusters.get('default')

    @fixture
    def backend(self):
        return RedisLockBackend(self.cluster)

    def test_success(self):
        key = u"\U0001F4A9"
        duration = 60
        full_key = self.backend.prefix_key(key)
        client = self.backend.get_client(key)

        self.backend.acquire(key, duration)
        assert client.get(full_key) == self.backend.uuid
        assert duration - 2 < float(client.ttl(full_key)) <= duration

        self.backend.release(key)
        assert client.exists(full_key) is False

    def test_acquire_fail_on_conflict(self):
        key = 'lock'
        duration = 60

        other_cluster = RedisLockBackend(self.cluster)
        other_cluster.acquire(key, duration)
        with pytest.raises(Exception):
            self.backend.acquire(key, duration)

    def test_release_fail_on_missing(self):
        with pytest.raises(Exception):
            self.backend.release('missing-key')

    def test_release_fail_on_conflict(self):
        key = 'lock'
        duration = 60
        self.backend.get_client(key).set(self.backend.prefix_key(key), 'someone-elses-uuid')

        with pytest.raises(Exception):
            self.backend.acquire(key, duration)
