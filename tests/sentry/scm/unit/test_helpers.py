from sentry.scm.private.helpers import exec_provider_fn
from tests.sentry.scm.test_fixtures import BaseTestProvider


def test_exec_provider_fn() -> None:
    metrics = []

    def record_count(k, a, t):
        metrics.append((k, a, t))

    provider = BaseTestProvider()
    result = exec_provider_fn(
        provider,
        referrer="emerge",
        provider_fn=lambda: 42,
        record_count=record_count,
    )
    assert result == 42
    assert metrics == [
        ("sentry.scm.actions.success_by_provider", 1, {"provider": "BaseTestProvider"}),
        ("sentry.scm.actions.success_by_referrer", 1, {"referrer": "emerge"}),
    ]
