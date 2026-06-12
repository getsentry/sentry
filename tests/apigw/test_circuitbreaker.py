import pytest

from apigw.circuitbreaker import (
    CircuitBreaker,
    CircuitBreakerManager,
    CircuitBreakerOverflow,
    CircuitBreakerWindowOverflow,
)


@pytest.fixture
def anyio_backend() -> str:
    # the default anyio fixture parametrizes over every installed backend,
    # but the breaker (as apigw itself) is asyncio-only
    return "asyncio"


@pytest.mark.anyio
async def test_concurrency_overflow() -> None:
    breaker = CircuitBreaker(1, (60, 10))

    async with breaker.ctx():
        with pytest.raises(CircuitBreakerOverflow):
            async with breaker.ctx():
                pass

    # the slot is released on exit, sequential entries are fine
    async with breaker.ctx():
        pass


@pytest.mark.anyio
async def test_slot_released_on_error() -> None:
    breaker = CircuitBreaker(1, (60, 10))

    with pytest.raises(RuntimeError):
        async with breaker.ctx():
            raise RuntimeError("boom")

    assert not breaker.overflow()


@pytest.mark.anyio
async def test_failure_window_overflow() -> None:
    breaker = CircuitBreaker(1, (60, 2))

    for _ in range(3):
        async with breaker.ctx() as ctx:
            ctx.incr_failures()

    with pytest.raises(CircuitBreakerWindowOverflow):
        async with breaker.ctx():
            pass

    # the rejection happens after acquiring the slot: it must be released
    assert not breaker.overflow()


@pytest.mark.anyio
async def test_failure_window_recovery() -> None:
    breaker = CircuitBreaker(1, (60, 2))

    for _ in range(3):
        async with breaker.ctx() as ctx:
            ctx.incr_failures()

    with pytest.raises(CircuitBreakerWindowOverflow):
        async with breaker.ctx():
            pass

    # move the breaker clock past the window instead of sleeping: the
    # counters flip and the breaker closes again
    breaker._clock -= breaker.counter_window + 1

    async with breaker.ctx():
        pass


def test_manager_breaker_per_target() -> None:
    manager = CircuitBreakerManager(max_concurrency=2, failures=5, failure_window=30)

    ctx_us = manager.get("us")
    ctx_us_again = manager.get("us")
    ctx_de = manager.get("de")

    assert ctx_us.cb is ctx_us_again.cb
    assert ctx_de.cb is not ctx_us.cb
    assert ctx_us.cb.concurrency == 2
    assert ctx_us.cb.failures == 5
    assert ctx_us.cb.counter_window == 30
