from threading import Barrier
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from sentry.agent_handoff.codes import (
    HANDOFF_LIFETIME,
    AgentHandoff,
    IssuedAgentHandoff,
    _get_redis_client,
    _handoff_key,
    consume_handoff,
    issue_handoff,
    revoke_handoff,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


@control_silo_test
class AgentHandoffTest(TestCase):
    def issue(self) -> IssuedAgentHandoff:
        return issue_handoff(
            user_id=1,
            organization_id=2,
            application_id=3,
            scope_list=["org:read", "project:write"],
        )

    def test_stores_hashed_expiring_code_with_bound_context(self) -> None:
        issued = self.issue()
        client = _get_redis_client()
        key = _handoff_key(issued.code)
        raw = client.get(key)
        assert raw is not None
        assert issued.code.startswith("sntryh_")
        assert len(issued.code) == 50
        assert issued.code not in key
        assert issued.code.encode() not in raw
        assert issued.code not in repr(issued)
        assert 0 < client.ttl(key) <= int(HANDOFF_LIFETIME.total_seconds())
        assert json.loads(raw) == {
            "user_id": 1,
            "organization_id": 2,
            "application_id": 3,
            "scope_list": ["org:read", "project:write"],
        }

    def test_consume_is_single_use(self) -> None:
        issued = self.issue()
        assert consume_handoff(issued.code) == AgentHandoff(
            user_id=1,
            organization_id=2,
            application_id=3,
            scope_list=("org:read", "project:write"),
        )
        assert consume_handoff(issued.code) is None

    def test_expired_handoff_is_unavailable(self) -> None:
        issued = self.issue()
        _get_redis_client().expire(_handoff_key(issued.code), 0)
        assert consume_handoff(issued.code) is None

    def test_revoke_is_idempotent(self) -> None:
        issued = self.issue()
        revoke_handoff(issued.code)
        revoke_handoff(issued.code)
        assert consume_handoff(issued.code) is None

    def test_unknown_handoff_is_unavailable(self) -> None:
        assert consume_handoff("unrecognized-code") is None

    def test_concurrent_consumers_have_one_winner(self) -> None:
        issued = self.issue()
        client = _get_redis_client()
        read = client.get
        ready = Barrier(2)

        def read_before_consume(key: str) -> bytes | None:
            value = read(key)
            ready.wait(timeout=5)
            return value

        with (
            patch.object(client, "get", side_effect=read_before_consume),
            ContextPropagatingThreadPoolExecutor(max_workers=2) as executor,
        ):
            results = list(executor.map(consume_handoff, [issued.code, issued.code]))

        assert sum(result is not None for result in results) == 1
        assert consume_handoff(issued.code) is None

    def test_corrupt_persistence_is_rejected_and_consumed(self) -> None:
        issued = self.issue()
        _get_redis_client().set(_handoff_key(issued.code), '{"user_id":"invalid"}', ex=60)
        with pytest.raises(ValidationError):
            consume_handoff(issued.code)

        assert consume_handoff(issued.code) is None
