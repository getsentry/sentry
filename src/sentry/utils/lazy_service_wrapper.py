"""split out from sentry.utils.services to handle mypy plugin specialization"""

from __future__ import annotations

import enum
import inspect
import itertools
from collections.abc import Iterable, Mapping, MutableMapping, Sequence
from typing import Any, Final, Generic, TypeVar

from sentry.utils import metrics, warnings
from sentry.utils.imports import import_string

_EmptyType = enum.Enum("_EmptyType", "EMPTY")
empty: Final = _EmptyType.EMPTY


class Service:
    __all__: Iterable[str] = ()

    def validate(self) -> None:
        """
        Validates the settings for this backend (i.e. such as proper connection
        info).

        Raise ``InvalidConfiguration`` if there is a configuration error.
        """

    def setup(self) -> None:
        """
        Initialize this service.
        """


T = TypeVar("T", bound=Service)
U = TypeVar("U", bound=Service)


class LazyServiceWrapper(Generic[T]):
    """
    Lazyily instantiates a standard Sentry service class.

    >>> LazyServiceWrapper(BaseClass, 'path.to.import.Backend', {})

    Provides an ``expose`` method for dumping public APIs to a context, such as
    module locals:

    >>> service = LazyServiceWrapper(...)
    >>> service.expose(locals())
    """

    def __init__(
        self,
        backend_base: type[T],
        backend_path: str,
        options: Mapping[str, Any],
        dangerous: Sequence[type[Service]] = (),
        metrics_path: str | None = None,
    ) -> None:
        self._backend = backend_path
        self._options = options
        self._base = backend_base
        self._dangerous = dangerous
        self._metrics_path = metrics_path

        self._wrapped: _EmptyType | T = empty

    def _setup(self) -> None:
        if self._wrapped is not empty:
            return

        backend = import_string(self._backend)
        assert issubclass(backend, Service)
        if backend in self._dangerous:
            warnings.warn(
                warnings.UnsupportedBackend(
                    "The {!r} backend for {} is not recommended "
                    "for production use.".format(self._backend, self._base)
                )
            )
        instance = backend(**self._options)
        self._wrapped = instance

    # -> Any is used as a sentinel here.
    # tools.mypy_helpers.plugin fills in the actual type here
    # conveniently, nothing else on this class is `Any`
    def __getattr__(self, name: str) -> Any:
        self._setup()

        attr = getattr(self._wrapped, name)

        # If we want to wrap in metrics, we need to make sure it's some callable,
        # and within our list of exposed attributes. Then we can safely wrap
        # in our metrics decorator.
        if self._metrics_path and callable(attr) and name in self._base.__all__:
            return metrics.wraps(
                self._metrics_path, instance=name, tags={"backend": self._backend}
            )(attr)

        return attr

    def test_only__downcast_to(self, t: type[U]) -> U:
        """test-only method to allow typesafe calling on specific subclasses"""
        from sentry.utils.env import in_test_environment

        assert in_test_environment(), "this method is not to be called outside of test"

        self._setup()
        if not isinstance(self._wrapped, t):
            raise AssertionError(f"wrapped instance {self._wrapped!r} is not of type {t!r}!")
        return self._wrapped

    def expose(self, context: MutableMapping[str, Any]) -> None:
        base = self._base
        base_instance = base()
        for key in itertools.chain(base.__all__, ("validate", "setup")):
            if inspect.isroutine(getattr(base_instance, key)):
                context[key] = (lambda f: lambda *a, **k: getattr(self, f)(*a, **k))(key)
            else:
                context[key] = getattr(base_instance, key)
