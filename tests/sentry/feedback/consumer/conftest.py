import pytest


@pytest.fixture(scope="package")
def feedback_strategy_factory_cls():
    from sentry.ingest.consumer.factory import IngestStrategyFactory

    return IngestStrategyFactory
