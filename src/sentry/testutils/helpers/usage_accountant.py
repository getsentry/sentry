from __future__ import annotations
from typing import int

import contextlib
from collections.abc import Generator

from arroyo.backends.abstract import Producer
from arroyo.backends.kafka import KafkaPayload
from usageaccountant import UsageAccumulator

from sentry.usage_accountant import accountant


@contextlib.contextmanager
def usage_accountant_backend(producer: Producer[KafkaPayload]) -> Generator[None]:
    assert accountant._accountant_backend is None, accountant._accountant_backend
    accountant._accountant_backend = UsageAccumulator(producer=producer)
    try:
        yield
    finally:
        accountant._shutdown()
        accountant._accountant_backend = None
