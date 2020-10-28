from __future__ import absolute_import

from sentry import features
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature


class TestTestUtilsFeatureHelper(TestCase):
    def setUp(self):
        self.org = self.create_organization()

    def test_without_feature(self):
        assert not features.has("organizations:internal-catchall", self.org)

    @with_feature("organizations:internal-catchall")
    def test_with_feature(self):
        assert features.has("organizations:internal-catchall", self.org)
