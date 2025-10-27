from __future__ import annotations

import logging

import sentry_sdk
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, TStrategyPayload
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.threading import ThreadingIntegration

from sentry.utils.db import DjangoAtomicIntegration
from sentry.utils.rust import RustInfoIntegration
from sentry.utils.sdk import _get_sdk_options


class JoinProfiler(ProcessingStrategy[TStrategyPayload]):
    """
    Strategy which passes through all ProcessingStrategy method calls,
    but runs Sentry's continuous profiler for `join()` calls.

    This startegy is being used to troubleshoot our consumers hanging during `join()` occasionally.
    """

    def __init__(self, next_step: ProcessingStrategy[TStrategyPayload]) -> None:
        self.__next_step = next_step

    def join(self, timeout: float | None = None):
        sdk_options, dsns = _get_sdk_options()
        with sentry_sdk.init(
            dsn=dsns.sentry_saas,
            integrations=[
                DjangoAtomicIntegration(),
                DjangoIntegration(signals_spans=False, cache_spans=True),
                LoggingIntegration(event_level=None, sentry_logs_level=logging.INFO),
                RustInfoIntegration(),
                RedisIntegration(),
                ThreadingIntegration(),
            ],
            **sdk_options,
        ):
            with sentry_sdk.start_transaction(op="consumer_join", name="consumer.join.profiler"):
                self.__next_step.join(timeout)

    def submit(self, message: Message[TStrategyPayload]) -> None:
        self.__next_step.submit(message)

    def poll(self) -> None:
        self.__next_step.poll()

    def close(self) -> None:
        self.__next_step.close()

    def terminate(self) -> None:
        self.__next_step.terminate()
