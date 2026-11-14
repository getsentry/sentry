from __future__ import annotations

import ipaddress
import secrets
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Literal

from django.utils import timezone
from pydantic import (
    BaseModel,
    Extra,
    Field,
    StrictBool,
    StrictInt,
    StrictStr,
)
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import hashlib, redis

HANDOFF_LIFETIME = timedelta(minutes=5)
"""Time available to claim a handoff after it is issued."""

EXPIRED_HANDOFF_RETENTION = timedelta(days=1)
"""Time an unclaimed handoff is kept past expiry so late claims can be attributed."""

compare_and_delete = redis.load_redis_script("utils/compare_and_delete.lua")


class HandoffFlow(StrEnum):
    CREATE_PROJECT = "create_project"
    GUIDED_NEXT_STEPS = "guided_next_steps"
    ONBOARDING = "onboarding"


class ProjectSetupContext(BaseModel):
    run_id: StrictStr = Field(regex=r"^[a-f0-9]{32}$")

    class Config:
        frozen = True
        extra = Extra.forbid


HandoffContext = ProjectSetupContext | None


class _AgentHandoff(BaseModel):
    """Authorization context approved by the user for one agent handoff."""

    user_id: StrictInt
    organization_id: StrictInt
    application_id: StrictInt
    scope_list: tuple[StrictStr, ...]
    ip_address: StrictStr | None = None
    disable_ip_pinning: StrictBool = False
    expires_at: datetime

    class Config:
        frozen = True
        extra = Extra.forbid


class GuidedNextStepsHandoff(_AgentHandoff):
    flow: Literal[HandoffFlow.GUIDED_NEXT_STEPS] = HandoffFlow.GUIDED_NEXT_STEPS
    context: None = None


class OnboardingHandoff(_AgentHandoff):
    flow: Literal[HandoffFlow.ONBOARDING]
    context: ProjectSetupContext


class CreateProjectHandoff(_AgentHandoff):
    flow: Literal[HandoffFlow.CREATE_PROJECT]
    context: ProjectSetupContext


AgentHandoff = CreateProjectHandoff | GuidedNextStepsHandoff | OnboardingHandoff


class _StoredAgentHandoff(BaseModel):
    __root__: AgentHandoff


class HandoffExpired(Exception):
    """The handoff was not claimed within its lifetime."""

    def __init__(self, handoff: AgentHandoff) -> None:
        super().__init__("Agent handoff has expired")
        self.handoff = handoff


class HandoffIPMismatch(Exception):
    """The handoff is pinned to a different client IP address."""

    def __init__(self, handoff: AgentHandoff) -> None:
        super().__init__("Agent handoff is pinned to a different IP address")
        self.handoff = handoff


@dataclass(frozen=True)
class IssuedAgentHandoff:
    code: str = field(repr=False)
    expires_at: datetime


def _get_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    # Minting and claiming both run in the control silo's Redis deployment.
    return redis.redis_clusters.get_binary("default")


def _handoff_key(code: str) -> str:
    # Versioned because replicas on an older payload schema reject unknown fields. During a
    # rollout each version sees the other's codes as unavailable instead of failing to parse.
    return f"agent-handoff:v2:{hashlib.sha256_text(code).hexdigest()}"


def issue_handoff(
    *,
    flow: HandoffFlow,
    user_id: int,
    organization_id: int,
    application_id: int,
    scope_list: Sequence[str],
    ip_address: str,
    disable_ip_pinning: bool = False,
    context: HandoffContext = None,
) -> IssuedAgentHandoff:
    expires_at = timezone.now() + HANDOFF_LIFETIME
    handoff = _StoredAgentHandoff.parse_obj(
        {
            "flow": flow,
            "user_id": user_id,
            "organization_id": organization_id,
            "application_id": application_id,
            "scope_list": tuple(scope_list),
            "ip_address": str(ipaddress.ip_address(ip_address)),
            "disable_ip_pinning": disable_ip_pinning,
            "context": context,
            "expires_at": expires_at,
        },
    ).__root__
    code = f"sntryh_{secrets.token_urlsafe(32)}"
    stored = _get_redis_client().set(
        _handoff_key(code),
        handoff.json(exclude_defaults=True),
        ex=int((HANDOFF_LIFETIME + EXPIRED_HANDOFF_RETENTION).total_seconds()),
        nx=True,
    )
    if not stored:
        raise RuntimeError("Unable to create an agent handoff")

    return IssuedAgentHandoff(code=code, expires_at=expires_at)


def consume_handoff(code: str, *, ip_address: str | None) -> AgentHandoff | None:
    """Consume a handoff once; unavailable codes reveal no previous context."""
    client = _get_redis_client()
    key = _handoff_key(code)
    value = client.get(key)
    if value is None:
        return None

    handoff = _StoredAgentHandoff.parse_raw(value).__root__
    if handoff.expires_at <= timezone.now():
        raise HandoffExpired(handoff)

    if (
        not handoff.disable_ip_pinning
        and handoff.ip_address is not None
        and (
            ip_address is None
            or ipaddress.ip_address(handoff.ip_address) != ipaddress.ip_address(ip_address)
        )
    ):
        raise HandoffIPMismatch(handoff)

    # Compare-and-delete works on both Redis Cluster and sharded deployments.
    # Only the caller that deletes the value may receive its authorization context.
    if not compare_and_delete((key,), (value,), client):
        return None

    return handoff


def revoke_handoff(code: str) -> None:
    _get_redis_client().delete(_handoff_key(code))
