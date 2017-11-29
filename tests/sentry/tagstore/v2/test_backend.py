from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.tagstore.v2.backend import TagStorage


class V2TagStorage(TestCase):
    def setUp(self):
        self.tagstore = TagStorage()

    def test_simple(self):
        assert self.tagstore is not None
