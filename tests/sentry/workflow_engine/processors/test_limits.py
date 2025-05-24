from sentry.testutils.cases import TestCase
from sentry.workflow_engine.processors.limits import get_organization_limits


class TestLimits(TestCase):
    def test_limits_max_query_subscriptions(self):
        with self.settings(MAX_QUERY_SUBSCRIPTIONS_PER_ORG=38):
            limits = get_organization_limits(self.organization)
            assert limits.max_query_subscriptions == 38
