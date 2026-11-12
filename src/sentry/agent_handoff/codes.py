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
"""Time available to claim a handoff before its Redis entry expires."""

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


class HandoffIPMismatch(Exception):
    """The handoff is pinned to a different client IP address."""


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
    ip_address: str,
    disable_ip_pinning: bool = False,
    context: HandoffContext = None,
) -> IssuedAgentHandoff:
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
        },
    ).__root__
    code = f"sntryh_{secrets.token_urlsafe(32)}"
    expires_at = timezone.now() + HANDOFF_LIFETIME
    stored = _get_redis_client().set(
        _handoff_key(code),
        handoff.json(exclude_defaults=True),
        ex=int(HANDOFF_LIFETIME.total_seconds()),
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
    if (
        not handoff.disable_ip_pinning
        and handoff.ip_address is not None
        and (
            ip_address is None
            or ipaddress.ip_address(handoff.ip_address) != ipaddress.ip_address(ip_address)
        )
    ):
        raise HandoffIPMismatch

    # Compare-and-delete works on both Redis Cluster and sharded deployments.
    # Only the caller that deletes the value may receive its authorization context.
    if not compare_and_delete((key,), (value,), client):
        return None

    return handoff


def revoke_handoff(code: str) -> None:
    _get_redis_client().delete(_handoff_key(code))
