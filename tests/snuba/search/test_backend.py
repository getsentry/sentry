from __future__ import absolute_import

from sentry.search.django.backend import DjangoSearchBackend
from sentry.testutils import SnubaTestCase
from sentry.utils import snuba


class SnubaSearchTest(SnubaTestCase):
    def setUp(self):
        super(SnubaSearchTest, self).setUp()

        self.project.update_option('sentry:snuba', True)

    def test(self):
        backend = DjangoSearchBackend()

        backend
        snuba.query
