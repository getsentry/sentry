"""
The routing context control signs onto a webhook it queues for a cell.

Control resolves a webhook's integration and that integration's organizations to
pick the cells the webhook goes to, then forwards only the provider's own request.
A cell handler that needs the same answer has to ask control for it again. The
context carries the answer along with the queued request instead.

It is a hint, not an authority: a cell that cannot verify a context, or that finds
it stale, ignores it and resolves the integration the way it did before.
"""

from __future__ import annotations

import base64
import enum
import time
from typing import Literal

import orjson
import pydantic

from sentry.silo.util import (
    encode_webhook_delivery_context_signature,
    verify_webhook_delivery_context_signature,
)

MAX_ENCODED_CONTEXT_BYTES = 4096
"""
The largest encoded context control attaches and a cell reads. An integration linked
to more organizations than fit is delivered without one.
"""

MAX_FUTURE_SKEW_SECONDS = 5
"""
How far ahead of a cell's clock `issued_at` may be. The age limit is measured against
the cell's clock, so a context can be this much older than the limit says.
"""


class WebhookDeliveryContext(pydantic.BaseModel):
    version: Literal[1] = 1
    """Bumped on a change an older cell would misread. A cell rejects a version it
    does not know, and ignores fields it does not know."""

    provider: pydantic.StrictStr
    external_id: pydantic.StrictStr
    """The provider's identity for the installation, as `Integration.external_id`
    stores it. The handler checks it against the request body."""

    integration_id: pydantic.StrictInt
    organization_ids: frozenset[pydantic.StrictInt]
    """Every organization linked to the integration, whatever the link's status and
    whichever cell holds it. The cell narrows it to the organizations it has."""

    cell_names: frozenset[pydantic.StrictStr]
    """The cells control queued this delivery for."""

    event_type: pydantic.StrictStr | None
    delivery_id: pydantic.StrictStr | None
    """Request headers the handler acts on that the provider's signature does not
    cover. The handler checks them against the request."""

    issued_at: pydantic.StrictInt
    """Unix seconds, read before `organization_ids` was. Set once when the webhook is
    queued, so a retried delivery keeps the original."""

    class Config:
        frozen = True


class DeliveryContextUnsigned(enum.StrEnum):
    TOO_LARGE = "too_large"
    NO_KEY = "no_key"


class DeliveryContextRejection(enum.StrEnum):
    TOO_LARGE = "too_large"
    INVALID_SIGNATURE = "invalid_signature"
    MALFORMED = "malformed"
    EXPIRED = "expired"
    FROM_FUTURE = "from_future"
    WRONG_CELL = "wrong_cell"


def encode_webhook_delivery_context(context: WebhookDeliveryContext) -> str:
    """The context as one header-safe token."""
    payload = {
        "version": context.version,
        "provider": context.provider,
        "external_id": context.external_id,
        "integration_id": context.integration_id,
        "organization_ids": sorted(context.organization_ids),
        "cell_names": sorted(context.cell_names),
        "event_type": context.event_type,
        "delivery_id": context.delivery_id,
        "issued_at": context.issued_at,
    }
    return base64.urlsafe_b64encode(orjson.dumps(payload)).decode("ascii")


def sign_webhook_delivery_context(
    context: WebhookDeliveryContext, *, path: str, request_body: bytes
) -> tuple[str, str] | DeliveryContextUnsigned:
    """The encoded context and its signature, or why the delivery goes without one."""
    encoded = encode_webhook_delivery_context(context)
    if len(encoded) > MAX_ENCODED_CONTEXT_BYTES:
        return DeliveryContextUnsigned.TOO_LARGE
    signature = encode_webhook_delivery_context_signature(path, encoded, request_body)
    if signature is None:
        return DeliveryContextUnsigned.NO_KEY
    return encoded, signature


def verify_webhook_delivery_context(
    *,
    path: str,
    request_body: bytes,
    encoded: str,
    signature: str | None,
    cell_name: str,
    max_age_seconds: int,
) -> WebhookDeliveryContext | DeliveryContextRejection:
    """The context control signed for this request, or why it can't be used.

    Checks what holds for any provider. What ties a context to the provider's own
    request -- the installation in the body, the headers a handler dispatches on --
    is for the handler to check.
    """
    if len(encoded) > MAX_ENCODED_CONTEXT_BYTES:
        return DeliveryContextRejection.TOO_LARGE
    # Nothing is read out of the context until the signature holds.
    if not verify_webhook_delivery_context_signature(path, encoded, request_body, signature):
        return DeliveryContextRejection.INVALID_SIGNATURE
    try:
        context = WebhookDeliveryContext.parse_obj(orjson.loads(base64.urlsafe_b64decode(encoded)))
    except ValueError:
        # Covers the base64, JSON and schema failures alike. Signed by control, so it
        # is a version this cell does not know rather than tampering.
        return DeliveryContextRejection.MALFORMED

    age = int(time.time()) - context.issued_at
    if age < -MAX_FUTURE_SKEW_SECONDS:
        return DeliveryContextRejection.FROM_FUTURE
    if age > max_age_seconds:
        return DeliveryContextRejection.EXPIRED
    if cell_name not in context.cell_names:
        return DeliveryContextRejection.WRONG_CELL
    return context
