from __future__ import annotations

import base64
from collections.abc import Iterator

import orjson
import pytest
from django.test import override_settings

from sentry.hybridcloud.webhook_delivery_context import (
    MAX_ENCODED_CONTEXT_BYTES,
    MAX_FUTURE_SKEW_SECONDS,
    DeliveryContextRejection,
    DeliveryContextUnsigned,
    WebhookDeliveryContext,
    encode_webhook_delivery_context,
    sign_webhook_delivery_context,
    verify_webhook_delivery_context,
)
from sentry.silo.util import encode_webhook_delivery_context_signature
from sentry.testutils.helpers.datetime import freeze_time

PATH = "/extensions/github/webhook/"
BODY = b'{"installation": {"id": 12345}}'
NOW = 1_700_000_000
MAX_AGE = 30


def _context(**overrides: object) -> WebhookDeliveryContext:
    fields: dict[str, object] = {
        "provider": "github",
        "external_id": "12345",
        "integration_id": 7,
        "organization_ids": {3, 1, 2},
        "cell_names": {"us", "de"},
        "event_type": "check_suite",
        "delivery_id": "delivery-1",
        "issued_at": NOW,
    }
    return WebhookDeliveryContext.parse_obj({**fields, **overrides})


def _signed(context: WebhookDeliveryContext) -> tuple[str, str]:
    signed = sign_webhook_delivery_context(context, path=PATH, request_body=BODY)
    assert not isinstance(signed, DeliveryContextUnsigned)
    return signed


def _verify(
    encoded: str,
    signature: str | None,
    *,
    path: str = PATH,
    body: bytes = BODY,
    cell_name: str = "us",
) -> WebhookDeliveryContext | DeliveryContextRejection:
    return verify_webhook_delivery_context(
        path=path,
        request_body=body,
        encoded=encoded,
        signature=signature,
        cell_name=cell_name,
        max_age_seconds=MAX_AGE,
    )


def _sign_raw(payload: dict[str, object]) -> tuple[str, str]:
    """A payload control never builds, signed as if it had."""
    encoded = base64.urlsafe_b64encode(orjson.dumps(payload)).decode("ascii")
    signature = encode_webhook_delivery_context_signature(PATH, encoded, BODY)
    assert signature is not None
    return encoded, signature


@pytest.fixture(autouse=True)
def frozen_now() -> Iterator[None]:
    with freeze_time("2023-11-14T22:13:20Z"):
        yield


def test_round_trip() -> None:
    context = _context()

    encoded, signature = _signed(context)

    assert _verify(encoded, signature) == context


def test_encoding_does_not_depend_on_set_order() -> None:
    assert encode_webhook_delivery_context(
        _context(organization_ids=[1, 2, 3], cell_names=["de", "us"])
    ) == encode_webhook_delivery_context(
        _context(organization_ids=[3, 2, 1], cell_names=["us", "de"])
    )


def test_rejects_a_missing_signature() -> None:
    encoded, _ = _signed(_context())

    assert _verify(encoded, None) == DeliveryContextRejection.INVALID_SIGNATURE


def test_rejects_a_context_moved_to_another_body() -> None:
    encoded, signature = _signed(_context())

    assert (
        _verify(encoded, signature, body=b'{"installation": {"id": 999}}')
        == DeliveryContextRejection.INVALID_SIGNATURE
    )


def test_rejects_a_context_moved_to_another_path() -> None:
    encoded, signature = _signed(_context())

    assert (
        _verify(encoded, signature, path="/extensions/github-enterprise/webhook/")
        == DeliveryContextRejection.INVALID_SIGNATURE
    )


def test_rejects_an_edited_context() -> None:
    _, signature = _signed(_context())
    edited = encode_webhook_delivery_context(_context(organization_ids=[1, 2, 3, 4]))

    assert _verify(edited, signature) == DeliveryContextRejection.INVALID_SIGNATURE


def test_does_not_decode_an_unsigned_context() -> None:
    assert _verify("not base64 at all", "v1=abc") == DeliveryContextRejection.INVALID_SIGNATURE


def test_rejects_a_version_it_does_not_know() -> None:
    payload = orjson.loads(base64.urlsafe_b64decode(_signed(_context())[0]))
    encoded, signature = _sign_raw({**payload, "version": 2})

    assert _verify(encoded, signature) == DeliveryContextRejection.MALFORMED


def test_rejects_a_signed_context_that_is_not_one() -> None:
    encoded, signature = _sign_raw({"integration_id": "7"})

    assert _verify(encoded, signature) == DeliveryContextRejection.MALFORMED


def test_ignores_a_field_it_does_not_know() -> None:
    context = _context()
    payload = orjson.loads(base64.urlsafe_b64decode(_signed(context)[0]))
    encoded, signature = _sign_raw({**payload, "added_later": True})

    assert _verify(encoded, signature) == context


def test_accepts_a_context_at_the_age_limit() -> None:
    context = _context(issued_at=NOW - MAX_AGE)

    assert _verify(*_signed(context)) == context


def test_rejects_a_context_past_the_age_limit() -> None:
    encoded, signature = _signed(_context(issued_at=NOW - MAX_AGE - 1))

    assert _verify(encoded, signature) == DeliveryContextRejection.EXPIRED


def test_accepts_a_context_within_clock_skew() -> None:
    context = _context(issued_at=NOW + MAX_FUTURE_SKEW_SECONDS)

    assert _verify(*_signed(context)) == context


def test_rejects_a_context_from_the_future() -> None:
    encoded, signature = _signed(_context(issued_at=NOW + MAX_FUTURE_SKEW_SECONDS + 1))

    assert _verify(encoded, signature) == DeliveryContextRejection.FROM_FUTURE


def test_rejects_a_cell_control_did_not_queue_it_for() -> None:
    encoded, signature = _signed(_context())

    assert _verify(encoded, signature, cell_name="s4s2") == DeliveryContextRejection.WRONG_CELL


def test_does_not_sign_a_context_over_the_size_limit() -> None:
    context = _context(organization_ids=list(range(10**15, 10**15 + 500)))

    assert len(encode_webhook_delivery_context(context)) > MAX_ENCODED_CONTEXT_BYTES
    assert (
        sign_webhook_delivery_context(context, path=PATH, request_body=BODY)
        == DeliveryContextUnsigned.TOO_LARGE
    )


def test_rejects_a_context_over_the_size_limit() -> None:
    encoded = encode_webhook_delivery_context(
        _context(organization_ids=list(range(10**15, 10**15 + 500)))
    )
    signature = encode_webhook_delivery_context_signature(PATH, encoded, BODY)

    assert _verify(encoded, signature) == DeliveryContextRejection.TOO_LARGE


@override_settings(SENTRY_SUBNET_SECRET=None)
def test_does_not_sign_without_a_secret() -> None:
    assert (
        sign_webhook_delivery_context(_context(), path=PATH, request_body=BODY)
        == DeliveryContextUnsigned.NO_KEY
    )
