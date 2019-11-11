from __future__ import absolute_import

from sentry.search.moresnuba.backend import MoreSnubaSearchBackend
from tests.snuba.search.test_backend import SnubaSearchTest


class MoreSnubaSearchTest(SnubaSearchTest):
    def setUp(self):
        super(MoreSnubaSearchTest, self).setUp()
        self.backend = MoreSnubaSearchBackend()
