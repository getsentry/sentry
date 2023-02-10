from sentry.services.hybrid_cloud.rpc.endpoints import look_up_method
from sentry.services.hybrid_cloud.user import user_service
from sentry.testutils import TestCase


class RpcServiceEndpointTest(TestCase):
    def test_decorators(self):
        assert user_service
        assert look_up_method("user", "get_many_by_email")
