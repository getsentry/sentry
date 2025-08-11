from unittest import mock

from sentry.utils import metrics


@mock.patch("sentry.utils.metrics.precise_backend")
@mock.patch("sentry.utils.metrics.backend")
def test_precise_distribution(backend, precise):
    metrics.distribution("foo", 100, tags={"some": "stuff"}, unit="byte")

    backend.distribution.assert_called_once()
    precise.distribution.assert_not_called()
    backend.reset_mock()

    metrics.distribution("foo", 100, tags={"some": "stuff"}, unit="byte", precise=True)

    backend.distribution.assert_called_once()
    precise.distribution.assert_called_once()
