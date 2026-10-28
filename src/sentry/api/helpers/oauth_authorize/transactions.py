import secrets
import time
from typing import Literal, TypedDict

from django.contrib.sessions.backends.base import SessionBase

from sentry.api.helpers.oauth_authorize.request import (
    AuthorizationRequest,
    get_active_application,
)
from sentry.api.helpers.oauth_authorize.response import InvalidAuthorizationRequest

OAUTH_AUTHORIZE_SESSION_TTL = 10 * 60

INVALID_TRANSACTION = (
    "We were unable to complete your request. Please re-initiate the authorization flow."
)


class AuthorizationSession(TypedDict):
    rt: Literal["code", "token"]
    cid: str
    ru: str
    sc: list[str]
    st: str | None
    uid: int
    cc: str | None
    ccm: Literal["S256"] | None
    tx: str
    ts: float


def expired_authorize_keys(session: SessionBase, now: float) -> list[str]:
    expired = []
    for key in list(session.keys()):
        if not key.startswith("oa2:"):
            continue

        entry = session.get(key)
        # Device consent shares the namespace, with a different payload shape.
        if not isinstance(entry, dict) or "tx" not in entry:
            continue

        ts = entry.get("ts")
        if not isinstance(ts, (int, float)) or now - ts > OAUTH_AUTHORIZE_SESSION_TTL:
            expired.append(key)

    return expired


def prune_authorization_transactions(session: SessionBase) -> None:
    for key in expired_authorize_keys(session, time.time()):
        session.pop(key, None)


def save_authorization_transaction(
    session: SessionBase, authorization: AuthorizationRequest, user_id: int
) -> str:
    # Each tab gets an independent transaction bound to the consenting user.
    transaction_id = secrets.token_urlsafe(32)
    payload: AuthorizationSession = {
        "rt": authorization.response_type,
        "cid": authorization.application.client_id,
        "ru": authorization.redirect_uri,
        "sc": authorization.scopes,
        "st": authorization.state,
        "uid": user_id,
        "cc": authorization.code_challenge,
        "ccm": authorization.code_challenge_method,
        "tx": transaction_id,
        "ts": time.time(),
    }
    session[f"oa2:{transaction_id}"] = payload
    return transaction_id


def consume_authorization_transaction(
    session: SessionBase, transaction_id: str, user_id: int
) -> AuthorizationRequest:
    key = f"oa2:{transaction_id}"
    if key in expired_authorize_keys(session, time.time()):
        session.pop(key, None)
        raise InvalidAuthorizationRequest(
            "Your authorization request has expired. Please start over."
        )

    # Payloads are written by save_authorization_transaction in the server session.
    payload: AuthorizationSession | None = session.get(key)
    if payload is None or payload.get("tx") != transaction_id:
        raise InvalidAuthorizationRequest(INVALID_TRANSACTION)

    try:
        application = get_active_application(payload["cid"])
    except InvalidAuthorizationRequest:
        session.pop(key, None)
        raise

    del session[key]
    if payload["uid"] != user_id:
        raise InvalidAuthorizationRequest(INVALID_TRANSACTION)

    return AuthorizationRequest(
        application=application,
        response_type=payload["rt"],
        redirect_uri=payload["ru"],
        scopes=payload["sc"],
        state=payload["st"],
        code_challenge=payload.get("cc"),
        code_challenge_method=payload.get("ccm"),
    )
