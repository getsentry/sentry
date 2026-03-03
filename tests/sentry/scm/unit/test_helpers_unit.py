from sentry.scm.helpers import exec_provider_fn
from tests.sentry.scm.test_fixtures import BaseTestProvider


def test_exec_provider_fn():
    metrics = []

    def record_count(k, a, t):
        metrics.append((k, a, t))

    provider = BaseTestProvider()
    result = exec_provider_fn(
        provider,
        referrer="emerge",
        provider_fn=lambda p: 42,
        record_count=record_count,
    )
    assert result == 42
    assert metrics == [
        ("sentry.scm.actions.success", 1, {"provider": "BaseTestProvider"}),
        ("sentry.scm.actions.success", 1, {"referrer": "emerge"}),
    ]
