from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from sentry.agent_handoff.codes import (
    EXPIRED_HANDOFF_RETENTION,
    HANDOFF_LIFETIME,
    GuidedNextStepsHandoff,
    HandoffExpired,
    HandoffFlow,
    HandoffIPMismatch,
    IssuedAgentHandoff,
    ProjectSetupContext,
    _get_redis_client,
    _handoff_key,
    _StoredAgentHandoff,
    consume_handoff,
    issue_handoff,
    revoke_handoff,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.utils import hashlib, json
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


@control_silo_test
class AgentHandoffTest(TestCase):
    def issue(
        self, ip_address: str = "192.0.2.1", *, disable_ip_pinning: bool = False
    ) -> IssuedAgentHandoff:
        return issue_handoff(
            flow=HandoffFlow.GUIDED_NEXT_STEPS,
            user_id=1,
            organization_id=2,
            application_id=3,
            scope_list=["org:read", "project:write"],
            ip_address=ip_address,
            disable_ip_pinning=disable_ip_pinning,
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
        retention = HANDOFF_LIFETIME + EXPIRED_HANDOFF_RETENTION
        assert int(HANDOFF_LIFETIME.total_seconds()) < client.ttl(key)
        assert client.ttl(key) <= int(retention.total_seconds())
        assert json.loads(raw) == {
            "user_id": 1,
            "organization_id": 2,
            "application_id": 3,
            "scope_list": ["org:read", "project:write"],
            "ip_address": "192.0.2.1",
            "expires_at": issued.expires_at.isoformat(),
        }

    def test_consume_is_single_use(self) -> None:
        issued = self.issue()
        assert consume_handoff(issued.code, ip_address="192.0.2.1") == GuidedNextStepsHandoff(
            user_id=1,
            organization_id=2,
            application_id=3,
            scope_list=("org:read", "project:write"),
            ip_address="192.0.2.1",
            expires_at=issued.expires_at,
        )
        assert consume_handoff(issued.code, ip_address="192.0.2.1") is None

    def test_evicted_handoff_is_unavailable(self) -> None:
        issued = self.issue()
        _get_redis_client().expire(_handoff_key(issued.code), 0)
        assert consume_handoff(issued.code, ip_address="192.0.2.1") is None

    def test_expired_handoff_is_retained_for_attribution(self) -> None:
        issued = self.issue()
        with freeze_time(issued.expires_at + timedelta(seconds=1)):
            for _ in range(2):
                with pytest.raises(HandoffExpired) as error:
                    consume_handoff(issued.code, ip_address="192.0.2.1")
                assert error.value.handoff.user_id == 1

    def test_expiry_takes_precedence_over_ip_mismatch(self) -> None:
        issued = self.issue()
        with freeze_time(issued.expires_at), pytest.raises(HandoffExpired):
            consume_handoff(issued.code, ip_address="192.0.2.2")

    def test_handoff_from_previous_key_version_is_unavailable(self) -> None:
        issued = self.issue()
        client = _get_redis_client()
        raw = client.get(_handoff_key(issued.code))
        assert raw is not None
        client.delete(_handoff_key(issued.code))
        client.set(f"agent-handoff:{hashlib.sha256_text(issued.code).hexdigest()}", raw)
        assert consume_handoff(issued.code, ip_address="192.0.2.1") is None

    def test_ip_mismatch_carries_handoff(self) -> None:
        issued = self.issue()
        with pytest.raises(HandoffIPMismatch) as error:
            consume_handoff(issued.code, ip_address="192.0.2.2")
        assert error.value.handoff.user_id == 1

    def test_revoke_is_idempotent(self) -> None:
        issued = self.issue()
        revoke_handoff(issued.code)
        revoke_handoff(issued.code)
        assert consume_handoff(issued.code, ip_address="192.0.2.1") is None

    def test_unknown_handoff_is_unavailable(self) -> None:
        assert consume_handoff("unrecognized-code", ip_address="192.0.2.1") is None

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
            results = list(
                executor.map(
                    lambda code: consume_handoff(code, ip_address="192.0.2.1"),
                    [issued.code, issued.code],
                )
            )

        assert sum(result is not None for result in results) == 1
        assert consume_handoff(issued.code, ip_address="192.0.2.1") is None

    def test_corrupt_persistence_is_rejected(self) -> None:
        issued = self.issue()
        _get_redis_client().set(_handoff_key(issued.code), '{"user_id":"invalid"}', ex=60)
        with pytest.raises(ValidationError):
            consume_handoff(issued.code, ip_address="192.0.2.1")

    def test_mismatched_ip_preserves_handoff(self) -> None:
        issued = self.issue()
        with pytest.raises(HandoffIPMismatch):
            consume_handoff(issued.code, ip_address="192.0.2.2")

        assert consume_handoff(issued.code, ip_address="192.0.2.1") is not None

    def test_missing_ip_cannot_claim_pinned_handoff(self) -> None:
        issued = self.issue()
        with pytest.raises(HandoffIPMismatch):
            consume_handoff(issued.code, ip_address=None)

        assert consume_handoff(issued.code, ip_address="192.0.2.1") is not None

    def test_unpinned_handoff_accepts_another_ip(self) -> None:
        issued = self.issue(disable_ip_pinning=True)
        handoff = consume_handoff(issued.code, ip_address="192.0.2.2")
        assert handoff is not None
        assert handoff.ip_address == "192.0.2.1"
        assert handoff.disable_ip_pinning

    def test_equivalent_ipv6_addresses_match(self) -> None:
        issued = self.issue(ip_address="2001:db8:0:0:0:0:0:1")
        assert consume_handoff(issued.code, ip_address="2001:db8::1") is not None


def test_handoff_defaults_to_guided_next_steps() -> None:
    handoff = _StoredAgentHandoff.parse_raw(
        '{"user_id":1,"organization_id":2,"application_id":3,"scope_list":["org:read"],"expires_at":"2026-01-01T00:00:00Z"}',
    ).__root__
    assert handoff.flow is HandoffFlow.GUIDED_NEXT_STEPS
    assert handoff.ip_address is None


def test_unknown_handoff_flow_is_rejected() -> None:
    with pytest.raises(ValidationError, match="flow"):
        _StoredAgentHandoff.parse_raw(
            '{"flow":"unsupported","user_id":1,"organization_id":2,'
            '"application_id":3,"scope_list":["org:read"],"expires_at":"2026-01-01T00:00:00Z"}',
        )


def test_guided_next_steps_rejects_onboarding_context() -> None:
    with pytest.raises(ValidationError, match="context"):
        _StoredAgentHandoff.parse_raw(
            '{"flow":"guided_next_steps","user_id":1,"organization_id":2,'
            '"application_id":3,"scope_list":["org:read"],"expires_at":"2026-01-01T00:00:00Z",'
            '"context":{"run_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}',
        )


def test_onboarding_flow_preserves_typed_context() -> None:
    handoff = _StoredAgentHandoff.parse_raw(
        '{"flow":"onboarding","user_id":1,"organization_id":2,'
        '"application_id":3,"scope_list":["org:read"],"expires_at":"2026-01-01T00:00:00Z",'
        '"context":{"run_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}',
    ).__root__
    assert handoff.flow is HandoffFlow.ONBOARDING
    assert handoff.context == ProjectSetupContext(run_id="a" * 32)


def test_onboarding_flow_requires_run_context() -> None:
    with pytest.raises(ValidationError, match="context"):
        _StoredAgentHandoff.parse_raw(
            '{"flow":"onboarding","user_id":1,"organization_id":2,'
            '"application_id":3,"scope_list":["org:read"],"expires_at":"2026-01-01T00:00:00Z"}',
        )


def test_create_project_flow_preserves_typed_context() -> None:
    handoff = _StoredAgentHandoff.parse_raw(
        '{"flow":"create_project","user_id":1,"organization_id":2,'
        '"application_id":3,"scope_list":["org:read"],"expires_at":"2026-01-01T00:00:00Z",'
        '"context":{"run_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}',
    ).__root__
    assert handoff.flow is HandoffFlow.CREATE_PROJECT
    assert handoff.context == ProjectSetupContext(run_id="a" * 32)


def test_create_project_flow_requires_run_context() -> None:
    with pytest.raises(ValidationError, match="context"):
        _StoredAgentHandoff.parse_raw(
            '{"flow":"create_project","user_id":1,"organization_id":2,'
            '"application_id":3,"scope_list":["org:read"],"expires_at":"2026-01-01T00:00:00Z"}',
        )
