from __future__ import annotations

import logging
from collections.abc import Mapping

from sentry import options
from sentry.utils import metrics
from sentry.utils.circuit_breaker2 import (
    CircuitBreaker,
    RateBasedTripStrategy,
    RateBasedTripStrategyConfig,
)

logger = logging.getLogger(__name__)


class RpcCircuitBreaker:
    """
    Tracks outbound RPC outcomes for one destination (a cell, or control) and decides
    whether calls to it should be rejected.

    Breaker failures (bad config, redis errors) are counted and swallowed, so the
    breaker can never fail an RPC by itself.
    """

    def __init__(self, destination: str, metric_tags: Mapping[str, str | int | None]) -> None:
        self.destination = destination
        self.metric_tags = metric_tags
        self._breaker = (
            self._build_breaker()
            if options.get("hybridcloud.rpc.circuit-breaker.enabled")
            else None
        )

    def _build_breaker(self) -> CircuitBreaker | None:
        base_config: RateBasedTripStrategyConfig = options.get(
            "hybridcloud.rpc.circuit-breaker.config"
        )
        config: RateBasedTripStrategyConfig = {**base_config, "metrics_key": "hybridcloud.rpc"}
        try:
            # One breaker per destination, so a failing cell doesn't block calls to the others.
            return CircuitBreaker(
                key=f"hybridcloud.rpc.{self.destination}",
                config=config,
                trip_strategy=RateBasedTripStrategy.from_config(config),
            )
        except Exception:
            self._record_internal_error("config")
            return None

    def should_reject(self) -> bool:
        """
        Whether to reject a call to this destination now. Calls the open breaker would
        reject are counted even when it isn't enforcing.
        """
        if self._breaker is None:
            return False

        try:
            allowed = self._breaker.should_allow_request()
        except Exception:
            self._record_internal_error("check")
            return False
        if allowed:
            return False

        metrics.incr("hybrid_cloud.dispatch_rpc.circuit_breaker.rejected", tags=self.metric_tags)
        return bool(options.get("hybridcloud.rpc.circuit-breaker.enforce"))

    def record_failure(self) -> None:
        self._record(failed=True)

    def record_response(self, status_code: int, duration: float) -> None:
        failed = duration > options.get(
            "hybridcloud.rpc.circuit-breaker.slow-call-seconds"
        ) or status_code in options.get("hybridcloud.rpc.circuit-breaker.failure-status-codes")
        self._record(failed=failed)

    def _record(self, failed: bool) -> None:
        if self._breaker is None:
            return

        try:
            if failed:
                self._breaker.record_error()
            else:
                self._breaker.record_success()
        except Exception:
            self._record_internal_error("record")

    def _record_internal_error(self, kind: str) -> None:
        logger.exception(
            "hybridcloud.rpc.circuit_breaker_error",
            extra={"kind": kind, "destination": self.destination},
        )
        metrics.incr(
            "hybrid_cloud.dispatch_rpc.circuit_breaker.error",
            tags={**self.metric_tags, "kind": kind},
        )
