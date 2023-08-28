from __future__ import annotations

from abc import ABC, abstractmethod
from unittest.mock import Mock

import pytest

from sentry.utils.concurrent import SynchronousExecutor
from sentry.utils.services import Delegator, Service


class Operation(Service, ABC):
    @abstractmethod
    def apply(self, x: int, y: int) -> int:
        raise NotImplementedError


class Add(Operation):
    def apply(self, x: int, y: int) -> int:
        return x + y


class Sub(Operation):
    def apply(self, x: int, y: int) -> int:
        return x - y


class Error(Operation):
    def apply(self, x: int, y: int) -> int:
        raise Exception("error")


@pytest.fixture
def delegator_fixture() -> tuple[Delegator, Mock, Mock]:
    executor = SynchronousExecutor()
    selector = Mock()
    callback = Mock()
    delegator = Delegator(
        Operation,
        {"add": (Add(), executor), "sub": (Sub(), executor), "error": (Error(), executor)},
        selector,
        callback,
    )
    return (delegator, selector, callback)


def test_single_backend(delegator_fixture: tuple[Delegator, Mock, Mock]) -> None:
    (delegator, selector, callback) = delegator_fixture
    selector.return_value = ["add"]

    assert delegator.apply(1, 1) == 2

    (_, method, kwargs), _ = selector.call_args
    assert method == "apply"
    assert kwargs.items() >= {"x": 1, "y": 1}.items()

    (_, method, kwargs, backends, futures), _ = callback.call_args
    assert method == "apply"
    assert kwargs.items() >= {"x": 1, "y": 1}.items()
    assert backends == ["add"]
    assert [f.result() for f in futures] == [2]


def test_multiple_backends(delegator_fixture: tuple[Delegator, Mock, Mock]) -> None:
    (delegator, selector, callback) = delegator_fixture
    selector.return_value = ["add", "sub", "error"]

    assert delegator.apply(1, 1) == 2

    (_, _, _, backends, futures), _ = callback.call_args

    results = dict(zip(backends, futures))
    assert results["add"].result() == 2
    assert results["sub"].result() == 0
    with pytest.raises(Exception):
        results["error"].result()


def test_invalid_primary_backend(delegator_fixture: tuple[Delegator, Mock, Mock]) -> None:
    (delegator, selector, callback) = delegator_fixture
    selector.return_value = ["invalid", "add"]

    with pytest.raises(Delegator.InvalidBackend):
        assert delegator.apply(1, 1)

    assert callback.called is False


def test_invalid_secondary_backend(delegator_fixture: tuple[Delegator, Mock, Mock]) -> None:
    (delegator, selector, callback) = delegator_fixture
    selector.return_value = ["add", "invalid"]

    assert delegator.apply(1, 1) == 2

    (_, _, _, backends, futures), _ = callback.call_args
    assert backends == ["add", "invalid"]

    primary_future, secondary_future = futures
    assert primary_future.result() == 2
    assert secondary_future is None
