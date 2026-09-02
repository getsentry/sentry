from sentry_protos.taskbroker.v1.taskbroker_pb2 import RetryState, TaskActivation
from taskbroker_client.state import clear_current_task, set_current_task

from sentry.taskworker.tasks.examples import retry_state
from sentry.testutils.cases import TestCase
from sentry.utils.redis import redis_clusters


class RetryStateTest(TestCase):
    def test_marker_key_expires(self) -> None:
        # An attempt one below max_attempts is the terminal one, so the retry helper
        # raises NoRetriesRemainingError instead of asking for another attempt.
        set_current_task(TaskActivation(retry_state=RetryState(attempts=1, max_attempts=2)))
        self.addCleanup(clear_current_task)

        retry_state()

        redis = redis_clusters.get("default")
        assert redis.ttl("no-retries-remaining") > 0
