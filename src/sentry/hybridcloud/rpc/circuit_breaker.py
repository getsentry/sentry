from __future__ import annotations

import logging
from collections.abc import Mapping

from sentry_sdk import traces

from sentry import options
from sentry.utils import metrics
from sentry.utils.circuit_breaker2 import (
    CircuitBreaker,
    RateBasedTripStrategy,
    RateBasedTripStrategyConfig,
)

logger = logging.getLogger(__name__)

# Statuses that mean the destination itself is unhealthy. Plain 500s usually come from
# one method or one bad input, so they don't count against the whole destination.
_FAILURE_STATUSES = frozenset((502, 503, 504))


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
        try:
            base_config: RateBasedTripStrategyConfig = options.get(
                "hybridcloud.rpc.circuit-breaker.config"
            )
            config: RateBasedTripStrategyConfig = {**base_config, "metrics_key": "hybridcloud.rpc"}
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
        Whether to reject a call to this destination now. Calls to the open breaker
        that would reject are counted even when it isn't enforcing.
        """
        if self.destination in options.get(
            "hybridcloud.rpc.circuit-breaker.force-open-destinations"
        ):
            self._record_rejection("forced")
            return True

        if self._breaker is None:
            return False

        try:
            allowed = self._breaker.should_allow_request()
        except Exception:
            self._record_internal_error("check")
            return False
        if allowed:
            return False

        self._record_rejection("tripped")
        return bool(options.get("hybridcloud.rpc.circuit-breaker.enforce"))

    def record_failure(self) -> None:
        self._record(failed=True)

    def record_response(self, status_code: int, duration: float) -> None:
        slow = duration > options.get("hybridcloud.rpc.circuit-breaker.slow-call-seconds")
        self._record(failed=slow or status_code in _FAILURE_STATUSES)

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

    def _record_rejection(self, reason: str) -> None:
        metrics.incr(
            "hybrid_cloud.dispatch_rpc.circuit_breaker.rejected",
            tags={**self.metric_tags, "reason": reason},
        )
        # Tag the RPC span so traces show which requests the breaker turned away.
        span = traces.get_current_span()
        if span:
            span.set_attribute("circuit_breaker.rejected", reason)
            span.set_attribute("circuit_breaker.destination", self.destination)

    def _record_internal_error(self, kind: str) -> None:
        logger.exception(
            "hybridcloud.rpc.circuit_breaker_error",
            extra={"kind": kind, "destination": self.destination},
        )
        metrics.incr(
            "hybrid_cloud.dispatch_rpc.circuit_breaker.error",
            tags={**self.metric_tags, "kind": kind},
        )
