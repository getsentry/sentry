from collections import deque

from sentry.services.hybrid_cloud import RpcModel
from sentry.testutils import TestCase


class RpcModelTest(TestCase):
    def test_schema_generation(self):
        for api_type in self._get_rpc_model_subclasses():
            # We're mostly interested in whether an error occurs
            schema = api_type.schema_json()
            assert schema

    def _get_rpc_model_subclasses(self):
        subclasses = set()
        stack = deque([RpcModel])
        while stack:
            next_class = stack.pop()
            if next_class not in subclasses:
                subclasses.add(next_class)
                stack += next_class.__subclasses__()

        subclasses.remove(RpcModel)
        return subclasses
