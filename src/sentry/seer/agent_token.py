"""Short-lived, scope-bound capability tokens for the Seer agent.

Tokens are signed JWTs, not stored (verified by signature/claims, re-minted on demand);
only :class:`SeerAgentWriteGrant`, the durable record of user consent, persists.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import NotRequired, TypedDict, TypeGuard

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.db import router, transaction
from django.http import HttpRequest
from django.utils import timezone
from jwt import PyJWTError
from rest_framework.request import Request

from sentry import features
from sentry.api.exceptions import DataSecrecyError
from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.services.auth.model import RpcAuthState, RpcMemberSsoState
from sentry.auth.superuser import (
    MAX_AGE,
    MAX_AGE_PRIVILEGED_ORG_ACCESS,
    SESSION_KEY,
    Superuser,
    get_superuser_scopes,
)
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcUserOrganizationContext
from sentry.seer.models.agent_write_grant import (
    AGENT_SESSION_ID_MAX_LENGTH,
    DEFAULT_EXPIRATION,
    SeerAgentWriteGrant,
)
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import jwt

FEATURE_FLAG = "organizations:seer-agent-token-flow"

# Distinct audience so the token can't be replayed against another audience that shares the
# signing secret (e.g. X-Viewer-Context JWTs).
AGENT_TOKEN_AUDIENCE = "sentry-agent-api"
AGENT_TOKEN_TYPE = "sentry-agent+jwt"

# TTL is the only bound on a leaked token, so keep it short.
DEFAULT_TOKEN_TTL = timedelta(minutes=5)

AGENT_TOKEN_KIND = "agent_token"
AGENT_SESSION_KIND = "agent_session"
AGENT_AUTHORIZATION_HEADER = "X-Sentry-Agent-Authorization"
SUPERUSER_SESSION_SALT = "sentry.seer.agent-superuser-session"
AGENT_TOKEN_VERSION = 1
AGENT_PRINCIPAL_SUBJECT_SEPARATOR = ":"


class AgentPrincipalType(StrEnum):
    USER = "user"


SUPPORTED_AGENT_PRINCIPAL_TYPES = frozenset({AgentPrincipalType.USER})
MINTABLE_AGENT_PRINCIPAL_TYPES = frozenset({AgentPrincipalType.USER})


class MintingPrincipalRejection(StrEnum):
    INTEGRATION = "integration"
    AGENT = "agent"
    UNSUPPORTED = "unsupported"


@dataclass(frozen=True)
class AgentPrincipal:
    type: AgentPrincipalType
    id: int


type MintingPrincipal = AgentPrincipal | MintingPrincipalRejection
type MintingUser = User | RpcUser | AnonymousUser


class AgentTokenClaims(TypedDict):
    ver: int
    aud: str
    sub: str
    org: int
    scopes: list[str]
    sid: str
    iat: int
    exp: int
    superuser_session: NotRequired[str]


def create_agent_authorization(
    request: HttpRequest | Request | None, organization: Organization
) -> str | None:
    """Delegate an existing elevated session to one org for at most one token lifetime."""
    if (
        request is None
        or request.auth is not None
        or not request.user.is_superuser
        or not features.has(FEATURE_FLAG, organization, actor=request.user)
    ):
        return None
    su = getattr(request, "superuser", None) or Superuser(request)
    if not su.is_active or su.requires_org_auth(organization):
        return None
    data = su.get_session_data()
    if data is None:
        return None
    # Reuse the browser's existing SSO, IP, org approval and customer-policy checks.
    get_superuser_scopes(
        RpcAuthState(sso_state=RpcMemberSsoState(), permissions=[]), request.user, organization
    )
    expires_at = min(data["exp"], data["idl"], timezone.now() + DEFAULT_TOKEN_TTL)
    if organization.id != su.org_id:
        expires_at = min(expires_at, data["exp"] - MAX_AGE + MAX_AGE_PRIVILEGED_ORG_ACCESS)
    if expires_at <= timezone.now():
        return None
    raw = request.session[SESSION_KEY]
    return signing.dumps(
        {
            "org": organization.id,
            "session": {key: raw[key] for key in ("uid", "tok", "idl", "exp")},
            "cookie_token": su.token,
            "ip_address": request.META["REMOTE_ADDR"],
            "exp": int(expires_at.timestamp()),
        },
        salt=SUPERUSER_SESSION_SALT,
    )


def superuser_session_access(
    proof: str, user: RpcUser, org_context: RpcUserOrganizationContext
) -> tuple[set[str], datetime] | None:
    """Recheck Sentry-signed session evidence and current policy; never renew elevation."""
    if not user.is_active or not user.is_superuser or user.is_suspended:
        return None
    try:
        payload = signing.loads(proof, salt=SUPERUSER_SESSION_SALT, max_age=DEFAULT_TOKEN_TTL)
        if payload["org"] != org_context.organization.id:
            return None
        data = Superuser.validate_session_data(
            payload["session"],
            cookie_token=payload["cookie_token"],
            user_id=user.id,
            ip_address=payload["ip_address"],
        )
        expires_at = datetime.fromtimestamp(payload["exp"], UTC)
        if data is None or expires_at <= timezone.now():
            return None
        scopes = get_superuser_scopes(
            RpcAuthState(sso_state=RpcMemberSsoState(), permissions=[]), user, org_context
        ) & set(readonly_scopes())
    except (signing.BadSignature, KeyError, TypeError, ValueError, DataSecrecyError):
        return None
    return scopes, expires_at


def _signing_key() -> str:
    key = settings.SEER_API_SHARED_SECRET
    if not key:
        raise ValueError("No agent token signing key configured.")
    return key


def readonly_scopes() -> frozenset[str]:
    # Not demo_mode.get_readonly_scopes(): that also allows project:releases, a write.
    return frozenset(settings.SENTRY_READONLY_SCOPES)


def resolve_minting_principal(
    user: MintingUser, auth: AuthenticatedToken | None
) -> MintingPrincipal:
    if is_agent_auth(auth) and auth.kind != AGENT_SESSION_KIND:
        return MintingPrincipalRejection.AGENT
    if isinstance(user, AnonymousUser):
        return MintingPrincipalRejection.UNSUPPORTED
    if user.is_sentry_app:
        return MintingPrincipalRejection.INTEGRATION
    return AgentPrincipal(AgentPrincipalType.USER, user.id)


def is_mintable_agent_principal(principal: MintingPrincipal) -> TypeGuard[AgentPrincipal]:
    return (
        isinstance(principal, AgentPrincipal) and principal.type in MINTABLE_AGENT_PRINCIPAL_TYPES
    )


def encode_principal_subject(principal: AgentPrincipal) -> str:
    return f"{principal.type.value}{AGENT_PRINCIPAL_SUBJECT_SEPARATOR}{principal.id}"


def decode_principal_subject(subject: str) -> AgentPrincipal:
    principal_type, separator, principal_id = subject.partition(AGENT_PRINCIPAL_SUBJECT_SEPARATOR)
    if separator != AGENT_PRINCIPAL_SUBJECT_SEPARATOR:
        raise jwt.DecodeError("invalid agent token subject")
    try:
        parsed_type = AgentPrincipalType(principal_type)
    except ValueError:
        raise jwt.DecodeError("unsupported agent token principal")
    if parsed_type not in SUPPORTED_AGENT_PRINCIPAL_TYPES:
        raise jwt.DecodeError("unsupported agent token principal")
    if not principal_id.isdigit():
        raise jwt.DecodeError("invalid agent token subject")
    return AgentPrincipal(parsed_type, int(principal_id))


def principal_from_claims(claims: AgentTokenClaims) -> AgentPrincipal:
    return decode_principal_subject(claims["sub"])


def active_grant_scopes(organization_id: int, user_id: int, session_id: str) -> set[str]:
    """Unexpired scopes the user approved for the agent in this org + session. Keyed on
    authenticated identity, never client input."""
    scopes: set[str] = set()
    grants = SeerAgentWriteGrant.objects.filter(
        organization_id=organization_id,
        user_id=user_id,
        agent_session_id=session_id,
        expires_at__gt=timezone.now(),
    )
    for grant in grants:
        scopes.update(grant.get_scopes())
    return scopes


def compute_token_scopes(
    caller_scopes: Iterable[str],
    organization_id: int,
    user_id: int,
    session_id: str,
    requested_scopes: Iterable[str] | None = None,
) -> list[str]:
    """De-escalation rule: ``caller_scopes ∩ (read-only ∪ approved grants)``, optionally
    narrowed by ``requested_scopes``. Never exceeds the caller's own authority."""
    caller = set(caller_scopes)
    allowed = readonly_scopes() | active_grant_scopes(organization_id, user_id, session_id)
    effective = caller & allowed
    if requested_scopes is not None:
        effective &= set(requested_scopes)
    return sorted(effective)


def encode_agent_token(
    *,
    user_id: int,
    organization_id: int,
    scopes: Iterable[str],
    session_id: str,
    ttl: timedelta = DEFAULT_TOKEN_TTL,
    superuser_session: str | None = None,
) -> tuple[str, datetime]:
    """Mint a signed agent token. Returns the JWT and its expiry. No DB write."""
    now = timezone.now()
    expires_at = now + ttl
    principal = AgentPrincipal(AgentPrincipalType.USER, user_id)
    payload: AgentTokenClaims = {
        "ver": AGENT_TOKEN_VERSION,
        "aud": AGENT_TOKEN_AUDIENCE,
        # Keep the numeric wire subject until typed-subject decoding has reached every instance.
        "sub": str(principal.id),
        "org": organization_id,
        "scopes": sorted(scopes),
        "sid": session_id,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    if superuser_session is not None:
        payload["superuser_session"] = superuser_session
    token = jwt.encode(
        payload,
        _signing_key(),
        algorithm="HS256",
        headers={"typ": AGENT_TOKEN_TYPE},
    )
    return token, expires_at


def is_agent_token_string(token_str: str) -> bool:
    """Whether a bearer value should be routed to agent-token authentication.

    The header is only a routing hint here. ``decode_agent_token`` still verifies the signature,
    audience, expiry, algorithm, and protected ``typ`` before the credential is trusted.
    """
    try:
        return jwt.peek_header(token_str).get("typ") == AGENT_TOKEN_TYPE
    except PyJWTError:
        return False


def _normalize_numeric_user_subject(subject: object) -> str:
    if not isinstance(subject, str) or not subject.isdigit():
        raise jwt.DecodeError("invalid agent token subject")
    return encode_principal_subject(AgentPrincipal(AgentPrincipalType.USER, int(subject)))


def _validate_agent_token_version(version: object) -> int:
    if not isinstance(version, int) or isinstance(version, bool) or version != AGENT_TOKEN_VERSION:
        raise jwt.DecodeError("unsupported agent token version")
    return version


def _normalize_versioned_subject(subject: object) -> str:
    if not isinstance(subject, str):
        raise jwt.DecodeError("invalid agent token subject")
    if subject.isdigit():
        # Rolling deployments may still emit numeric subjects. Their five-minute expiry bounds
        # this compatibility path until typed-subject emission is enabled separately.
        return _normalize_numeric_user_subject(subject)
    decode_principal_subject(subject)
    return subject


def _normalize_principal_claims(version: object, subject: object) -> tuple[int, str]:
    if version is None:
        return AGENT_TOKEN_VERSION, _normalize_numeric_user_subject(subject)
    return _validate_agent_token_version(version), _normalize_versioned_subject(subject)


def _validate_timestamp_claim(value: object, claim_name: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise jwt.DecodeError(f"invalid agent token {claim_name}")
    return value


def _validate_claims(claims: Mapping[str, object]) -> AgentTokenClaims:
    required = ("aud", "sub", "org", "scopes", "sid", "iat", "exp")
    if any(name not in claims for name in required):
        raise jwt.DecodeError("missing agent token claim")

    audience = claims["aud"]
    if not isinstance(audience, str) or audience != AGENT_TOKEN_AUDIENCE:
        raise jwt.DecodeError("invalid agent token audience")

    version, subject = _normalize_principal_claims(claims.get("ver"), claims["sub"])

    organization_id = claims["org"]
    if not isinstance(organization_id, int) or isinstance(organization_id, bool):
        raise jwt.DecodeError("invalid agent token organization")

    scopes = claims["scopes"]
    if not isinstance(scopes, list) or not all(isinstance(scope, str) for scope in scopes):
        raise jwt.DecodeError("invalid agent token scopes")

    session_id = claims["sid"]
    if (
        not isinstance(session_id, str)
        or not session_id
        or len(session_id) > AGENT_SESSION_ID_MAX_LENGTH
    ):
        raise jwt.DecodeError("invalid agent token session")

    issued_at = _validate_timestamp_claim(claims["iat"], "iat")
    expires_at = _validate_timestamp_claim(claims["exp"], "exp")
    if expires_at <= issued_at:
        raise jwt.DecodeError("invalid agent token lifetime")

    result = AgentTokenClaims(
        ver=version,
        aud=audience,
        sub=subject,
        org=organization_id,
        scopes=scopes,
        sid=session_id,
        iat=issued_at,
        exp=expires_at,
    )
    if "superuser_session" in claims:
        proof = claims["superuser_session"]
        if not isinstance(proof, str) or not proof:
            raise jwt.DecodeError("invalid agent superuser session")
        result["superuser_session"] = proof
    return result


def decode_agent_token(token_str: str) -> AgentTokenClaims:
    """Verify signature, ``exp`` and ``aud``; return the claims. Raises a pyjwt error on any
    invalid token."""
    if not is_agent_token_string(token_str):
        raise jwt.DecodeError("not an agent token")
    claims = jwt.decode(
        token_str,
        _signing_key(),
        audience=AGENT_TOKEN_AUDIENCE,
        algorithms=["HS256"],
    )
    return _validate_claims(claims)


def is_agent_auth(auth: object) -> TypeGuard[AuthenticatedToken]:
    """Whether an authenticated credential is a Seer agent capability token."""
    return isinstance(auth, AuthenticatedToken) and auth.kind in {
        AGENT_TOKEN_KIND,
        AGENT_SESSION_KIND,
    }


def build_authenticated_token(claims: AgentTokenClaims) -> AuthenticatedToken:
    """Build a delegated-user credential from claims verified by ``decode_agent_token``."""
    principal = principal_from_claims(claims)
    return AuthenticatedToken(
        kind=AGENT_TOKEN_KIND,
        scopes=claims["scopes"],
        user_id=principal.id,
        organization_id=claims["org"],
        superuser_session=claims.get("superuser_session"),
    )


def create_write_grant(
    *, organization_id: int, user_id: int, session_id: str, scopes: Iterable[str]
) -> SeerAgentWriteGrant:
    """Merge ``scopes`` into the single grant for ``(org, user, session)`` and refresh its
    expiry, creating it if absent. The caller MUST have already capped ``scopes`` to the
    approving user's own authority. The unique constraint plus row lock keep concurrent
    approvals from racing."""
    now = timezone.now()
    with transaction.atomic(using=router.db_for_write(SeerAgentWriteGrant)):
        grant, created = SeerAgentWriteGrant.objects.select_for_update().get_or_create(
            organization_id=organization_id,
            user_id=user_id,
            agent_session_id=session_id,
            defaults={
                "scope_list": sorted(scopes),
            },
        )
        if not created:
            previous_scopes = set() if grant.expires_at <= now else set(grant.get_scopes())
            grant.scope_list = sorted(previous_scopes | set(scopes))
            grant.expires_at = now + DEFAULT_EXPIRATION
            grant.save(update_fields=["scope_list", "expires_at", "date_updated"])
    return grant
