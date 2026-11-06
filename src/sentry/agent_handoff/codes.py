from __future__ import annotations

import secrets
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import StrEnum

from django.utils import timezone
from pydantic import BaseModel, Extra, Field, StrictInt, StrictStr
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import hashlib, redis

HANDOFF_LIFETIME = timedelta(minutes=5)
"""Time available to claim a handoff before its Redis entry expires."""

compare_and_delete = redis.load_redis_script("utils/compare_and_delete.lua")


class HandoffFlow(StrEnum):
    GUIDED_NEXT_STEPS = "guided_next_steps"
    ONBOARDING = "onboarding"


class OnboardingHandoffContext(BaseModel):
    run_id: StrictStr = Field(regex=r"^[a-f0-9]{32}$")

    class Config:
        frozen = True
        extra = Extra.forbid


class AgentHandoff(BaseModel):
    """Authorization context approved by the user for one agent handoff."""

    flow: HandoffFlow = HandoffFlow.GUIDED_NEXT_STEPS
    user_id: StrictInt
    organization_id: StrictInt
    application_id: StrictInt
    scope_list: tuple[StrictStr, ...]
    context: OnboardingHandoffContext | None = None

    class Config:
        frozen = True
        extra = Extra.forbid


@dataclass(frozen=True)
class IssuedAgentHandoff:
    code: str = field(repr=False)
    expires_at: datetime


def _get_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    # Minting and claiming both run in the control silo's Redis deployment.
    return redis.redis_clusters.get_binary("default")


def _handoff_key(code: str) -> str:
    return f"agent-handoff:{hashlib.sha256_text(code).hexdigest()}"


def issue_handoff(
    *,
    flow: HandoffFlow,
    user_id: int,
    organization_id: int,
    application_id: int,
    scope_list: Sequence[str],
    context: OnboardingHandoffContext | None = None,
) -> IssuedAgentHandoff:
    handoff = AgentHandoff(
        flow=flow,
        user_id=user_id,
        organization_id=organization_id,
        application_id=application_id,
        scope_list=tuple(scope_list),
        context=context,
    )
    code = f"sntryh_{secrets.token_urlsafe(32)}"
    expires_at = timezone.now() + HANDOFF_LIFETIME
    # Keep default handoffs readable by servers during a rolling deploy.
    stored = _get_redis_client().set(
        _handoff_key(code),
        handoff.json(exclude_defaults=True),
        ex=int(HANDOFF_LIFETIME.total_seconds()),
        nx=True,
    )
    if not stored:
        raise RuntimeError("Unable to create an agent handoff")

    return IssuedAgentHandoff(code=code, expires_at=expires_at)


def consume_handoff(code: str) -> AgentHandoff | None:
    """Consume a handoff once; unavailable codes reveal no previous context."""
    client = _get_redis_client()
    key = _handoff_key(code)
    value = client.get(key)
    if value is None:
        return None

    # Compare-and-delete works on both Redis Cluster and sharded deployments.
    # Only the caller that deletes the value may receive its authorization context.
    if not compare_and_delete((key,), (value,), client):
        return None

    return AgentHandoff.parse_raw(value)


def revoke_handoff(code: str) -> None:
    _get_redis_client().delete(_handoff_key(code))
