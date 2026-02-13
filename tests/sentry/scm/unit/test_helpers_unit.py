from sentry.scm.helpers import exec_provider_fn
from tests.sentry.scm.test_fixtures import BaseTestProvider


def test_exec_provider_fn():
    metrics = []

    def record_count(k, a, t):
        metrics.append((k, a, t))

    result = exec_provider_fn(
        1,
        2,
        referrer="emerge",
        fetch_repository=lambda oid, rid: {
            "integration_id": 1,
            "name": "1",
            "organization_id": 1,
            "is_active": True,
        },
        fetch_service_provider=lambda a, b: BaseTestProvider(),
        provider_fn=lambda r, p: 42,
        record_count=record_count,
    )
    assert result == 42
    assert metrics == [
        ("sentry.scm.actions.success", 1, {"provider": "BaseTestProvider"}),
        ("sentry.scm.actions.success", 1, {"referrer": "emerge"}),
    ]
