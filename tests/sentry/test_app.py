# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry import app
from sentry.testutils import TestCase


class AppTest(TestCase):
    def test_buffer(self):
        from sentry.buffer.base import Buffer
        assert isinstance(app.buffer, Buffer)

    def test_digests(self):
        from sentry.digests.backends.base import Backend
        assert isinstance(app.digests, Backend)

    def test_nodestore(self):
        from sentry.nodestore.base import NodeStorage
        assert isinstance(app.nodestore, NodeStorage)

    def test_quotas(self):
        from sentry.quotas.base import Quota
        assert isinstance(app.quotas, Quota)

    def test_ratelimiter(self):
        from sentry.ratelimits.base import RateLimiter
        assert isinstance(app.ratelimiter, RateLimiter)

    def test_search(self):
        from sentry.search.base import SearchBackend
        assert isinstance(app.search, SearchBackend)

    def test_tsdb(self):
        from sentry.tsdb.base import BaseTSDB
        assert isinstance(app.tsdb, BaseTSDB)
