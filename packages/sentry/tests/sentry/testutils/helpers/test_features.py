from sentry import features
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature


class TestTestUtilsFeatureHelper(TestCase):
    def setUp(self):
        self.org = self.create_organization()

    def test_without_feature(self):
        assert not features.has("organizations:global-views", self.org)

    @with_feature("organizations:global-views")
    def test_with_feature(self):
        assert features.has("organizations:global-views", self.org)
