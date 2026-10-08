import re

import pytest

from sentry.sentry_apps.utils.idempotency import derive_idempotency_key, new_webhook_seed


def test_keys_are_stable_per_destination() -> None:
    seed = new_webhook_seed()
    first = derive_idempotency_key(seed, "installation", 123)
    assert first is not None
    assert re.fullmatch(r"[0-9a-f]{32}", first)
    assert first == derive_idempotency_key(seed, "installation", 123)
    assert first != derive_idempotency_key(seed, "installation", 456)
    assert first != derive_idempotency_key(seed, "servicehook", 123)


def test_new_jobs_get_distinct_keys() -> None:
    first_seed = new_webhook_seed()
    second_seed = new_webhook_seed()
    assert first_seed != second_seed
    assert derive_idempotency_key(first_seed, "installation", 123) != derive_idempotency_key(
        second_seed, "installation", 123
    )


def test_missing_seed_is_backward_compatible() -> None:
    assert derive_idempotency_key(None, "installation", 123) is None


def test_malformed_seeds_are_rejected() -> None:
    for seed in ("", "not-uuid", "0" * 32):
        with pytest.raises(ValueError, match="UUID4 hex"):
            derive_idempotency_key(seed, "installation", 123)
