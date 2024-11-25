from __future__ import annotations

import functools
import hashlib
import inspect
import logging
import threading
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from django.http.request import HttpRequest

from sentry import options
from sentry.conf.types.service_options import ServiceOptions
from sentry.utils.concurrent import Executor, FutureSet, ThreadedExecutor, TimedFuture

# TODO: adjust modules to import from new location -- the weird `as` syntax is for mypy
from sentry.utils.lazy_service_wrapper import LazyServiceWrapper as LazyServiceWrapper  # noqa: F401
from sentry.utils.lazy_service_wrapper import Service as Service

from .imports import import_string

logger = logging.getLogger(__name__)


def resolve_callable[CallableT: Callable[..., object]](value: str | CallableT) -> CallableT:
    if isinstance(value, str):
        return import_string(value)
    elif callable(value):
        return value
    else:
        raise TypeError("Expected callable or string")


class Context:
    def __init__(self, request: HttpRequest | None, backends: dict[type[Service | None], Service]):
        self.request = request
        self.backends = backends

    def copy(self) -> Context:
        return Context(self.request, self.backends.copy())


Selector = Callable[
    [Context, str, Mapping[str, Any]],
    Sequence[str],
]

Callback = Callable[
    [Context, str, Mapping[str, Any], Sequence[str], Sequence[TimedFuture[Any] | None]],
    None,
]


class Delegator:
    """
    The delegator is a class that coordinates and delegates method execution to
    multiple named backends that share a common API. It can be used to route
    requests to different backends based on method arguments, as well as execute
    the same request against multiple backends in parallel for testing backend
    performance and data consistency.

    The backends used for a method call are determined by a selector function
    which is provided with the current ``Context``, the method name (as a
    string) and arguments (in the form returned by ``inspect.getcallargs``) and
    expected to return a list of strings which correspond to names in the
    backend mapping. (This list should contain at least one member.) The first
    item in the result list is considered the "primary backend". The remainder
    of the items in the result list are considered "secondary backends". The
    result value of the primary backend will be the result value of the
    delegated method (to callers, this appears as a synchronous method call.)
    The secondary backends are called asynchronously in the background when
    using threaded executors (the default.) To receive the result values of
    these method calls, provide a callback, described below. If the primary
    backend name returned by the selector function doesn't correspond to any
    registered backend, the function will raise a ``InvalidBackend`` exception.
    If any referenced secondary backends are not registered names, they will be
    discarded and logged.

    The members and ordering of the selector function result (and thus the
    primary and secondary backends for a method call) may vary from call to
    call based on the calling arguments or some other state. For example, some
    calls may use a different primary backend based on some piece of global
    state (e.g. some property of a web request), or a secondary backend
    undergoing testing may be included based on the result of a random number
    generator (essentially calling it in the background for a sample of calls.)

    If provided, the callback is called after all futures have completed, either
    successfully or unsuccessfully. The function parameters are:

    - the context,
    - the method name (as a string),
    - the calling arguments (as returned by ``inspect.getcallargs``),
    - the backend names (as returned by the selector function),
    - a list of results (as either a ``Future``, or ``None`` if the backend
      was invalid) of the same length and ordering as the backend names.

    Implementation notes:

    - Only method access is delegated to the individual backends. Attribute
      values are returned from the base backend. Only methods that are defined
      on the base backend are eligible for delegation (since these methods are
      considered the public API.) Ideally, backend classes are concrete classes
      of the base abstract class, but this is not strictly enforced at runtime
      with instance checks.
    - The backend makes no attempt to synchronize common backend option values
      between backends (e.g. TSDB rollup configuration) to ensure equivalency
      of request parameters based on configuration.
    - Each backend is associated with an executor pool which defaults to a
      thread pool implementation unless otherwise specified in the backend
      configuration. If the backend itself is not thread safe (due to socket
      access, etc.), it's recommended to specify a pool size of 1 to ensure
      exclusive access to resources. Each executor is started when the first
      task is submitted.
    - The threaded executor does not use a bounded queue by default. If there
      are large throughput differences between the primary and secondary
      backend(s), a significant backlog may accumulate. In extreme cases, this can
      lead to memory exhaustion.
    - The request is added to the request queue of the primary backend using a
      blocking put. The request is added to the request queue(s) of the
      secondary backend(s) as a non-blocking put (if these queues are full, the
      request is rejected and the future will raise ``Queue.Full`` when
      attempting to retrieve the result.)
    """

    def __init__(
        self,
        base: type[Service],
        backends: Mapping[str, tuple[Service, Executor]],
        selector: Selector,
        callback: Callback | None = None,
    ) -> None:
        self.base = base
        self.backends = backends
        self.selector = selector
        self.callback = callback

    class InvalidBackend(Exception):
        """\
        Exception raised when an invalid backend is returned by a selector
        function.
        """

    class State(threading.local):
        def __init__(self) -> None:
            self.context: Context | None = None

    __state = State()

    def __getattr__(self, attribute_name: str) -> Any:
        # When deciding how to handle attribute accesses, we have three
        # different possible outcomes:
        # 1. If this is defined as a method on the base implementation, we are
        #    able delegate it to the backends based on the selector function.
        # 2. If this is defined as an attribute on the base implementation, we
        #    are able to (immediately) return that as the value. (This also
        #    mirrors the behavior of ``LazyServiceWrapper``, which will cache
        #    any attribute access during ``expose``, so we can't delegate
        #    attribute access anyway when using this as a service interface.)
        # 3. If this isn't defined at all on the base implementation, we let
        #    the ``AttributeError`` raised by ``getattr`` propagate (mirroring
        #    normal attribute access behavior for a missing/invalid name.)
        base_value = getattr(self.base, attribute_name)
        if not inspect.isroutine(base_value):
            return base_value

        def execute(*args: Any, **kwargs: Any) -> Any:
            context = type(self).__state.context

            # If there is no context object already set in the thread local
            # state, we are entering the delegator for the first time and need
            # to create a new context.
            if context is None:
                from sentry.app import env  # avoids a circular import

                context = Context(env.request, {})

            # If this thread already has an active backend for this base class,
            # we can safely call that backend synchronously without delegating.
            if self.base in context.backends:
                backend = context.backends[self.base]
                return getattr(backend, attribute_name)(*args, **kwargs)

            # Binding the call arguments to named arguments has two benefits:
            # 1. These values always be passed in the same form to the selector
            #    function and callback, regardless of how they were passed to
            #    the method itself (as positional arguments, keyword arguments,
            #    etc.)
            # 2. This ensures that the given arguments are those supported by
            #    the base backend itself, which should be a common subset of
            #    arguments that are supported by all backends.
            callargs = inspect.getcallargs(base_value, None, *args, **kwargs)

            selected_backend_names = list(self.selector(context, attribute_name, callargs))
            if not len(selected_backend_names) > 0:
                raise self.InvalidBackend("No backends returned by selector!")

            # Ensure that the primary backend is actually registered -- we
            # don't want to schedule any work on the secondaries if the primary
            # request is going to fail anyway.
            if selected_backend_names[0] not in self.backends:
                raise self.InvalidBackend(
                    f"{selected_backend_names[0]!r} is not a registered backend."
                )

            def call_backend_method(context: Context, backend: Service, is_primary: bool) -> Any:
                # Update the thread local state in the executor to the provided
                # context object. This allows the context to be propagated
                # across different threads.
                assert type(self).__state.context is None
                type(self).__state.context = context

                # Ensure that we haven't somehow accidentally entered a context
                # where the backend we're calling has already been marked as
                # active (or worse, some other backend is already active.)
                base = self.base
                assert base not in context.backends

                # Mark the backend as active.
                context.backends[base] = backend
                try:
                    return getattr(backend, attribute_name)(*args, **kwargs)
                except Exception as e:
                    # If this isn't the primary backend, we log any
                    # exceptions so that they don't pass by unnoticed. (Any
                    # exceptions raised by the primary backend aren't logged
                    # here, since it's assumed that the caller will log them
                    # from the calling thread.)
                    if not is_primary:
                        logger.warning(
                            "%s caught in executor while calling %r on %s.",
                            type(e).__name__,
                            attribute_name,
                            type(backend).__name__,
                            exc_info=True,
                        )
                    raise
                finally:
                    type(self).__state.context = None

            # Enqueue all of the secondary backend requests first since these
            # are non-blocking queue insertions. (Since the primary backend
            # executor queue insertion can block, if that queue was full the
            # secondary requests would have to wait unnecessarily to be queued
            # until the after the primary request can be enqueued.)
            # NOTE: If the same backend is both the primary backend *and* in
            # the secondary backend list -- this is unlikely, but possible --
            # this means that one of the secondary requests will be queued and
            # executed before the primary request is queued.  This is such a
            # strange usage pattern that I don't think it's worth optimizing
            # for.)
            results: list[TimedFuture[Any] | None] = [None] * len(selected_backend_names)
            for i, backend_name in enumerate(selected_backend_names[1:], 1):
                try:
                    backend, executor = self.backends[backend_name]
                except KeyError:
                    logger.warning(
                        "%r is not a registered backend and will be ignored.",
                        backend_name,
                        exc_info=True,
                    )
                else:
                    results[i] = executor.submit(
                        functools.partial(
                            call_backend_method, context.copy(), backend, is_primary=False
                        ),
                        priority=1,
                        block=False,
                    )

            # The primary backend is scheduled last since it may block the
            # calling thread. (We don't have to protect this from ``KeyError``
            # since we already ensured that the primary backend exists.)
            backend, executor = self.backends[selected_backend_names[0]]
            result = results[0] = executor.submit(
                functools.partial(call_backend_method, context.copy(), backend, is_primary=True),
                priority=0,
                block=True,
            )

            if self.callback is not None:
                FutureSet([_f for _f in results if _f]).add_done_callback(
                    lambda *a, **k: self.callback(
                        context, attribute_name, callargs, selected_backend_names, results
                    )
                )

            return result.result()

        return execute


def build_instance_from_options(
    options: ServiceOptions,
    *,
    default_constructor: Callable[..., object] | None = None,
) -> object:
    try:
        path = options["path"]
    except KeyError:
        if default_constructor:
            constructor = default_constructor
        else:
            raise
    else:
        constructor = resolve_callable(path)

    return constructor(**options.get("options", {}))


def build_instance_from_options_of_type[
    T
](
    tp: type[T],
    options: ServiceOptions,
    *,
    default_constructor: Callable[..., T] | None = None,
) -> T:
    ret = build_instance_from_options(options, default_constructor=default_constructor)
    if isinstance(ret, tp):
        return ret
    else:
        raise TypeError(f"expected built object of type {tp}, got {type(ret)}")


class ServiceDelegator(Delegator, Service):
    """\
    The backends are provided as mapping of backend name to configuration
    parameters:

        'redis': {
            'path': 'sentry.tsdb.redis.RedisTSDB',
            'executor': {
                'path': 'sentry.utils.services.ThreadedExecutor',
                'options': {
                    'worker_count': 1,
                },
            },
        },
        'dummy': {
            'path': 'sentry.tsdb.dummy.DummyTSDB',
            'executor': {
                'path': 'sentry.utils.services.ThreadedExecutor',
                'options': {
                    'worker_count': 4,
                },
            },
        },
        # ... etc ...

    The selector function and callback function can be provided as either:

    - A dotted import path string (``path.to.callable``) that will be
      imported at backend instantiation, or
    - A reference to a callable object.

    If you're shifting a service from one backend storage system to another
    consider using `make_writebehind_selector` to generate your selector function.
    """

    def __init__(
        self,
        backend_base: str,
        backends: Mapping[str, ServiceOptions],
        selector_func: str | Selector,
        callback_func: str | Callback | None = None,
    ):
        super().__init__(
            import_string(backend_base),
            {
                name: (
                    build_instance_from_options_of_type(Service, options),
                    build_instance_from_options_of_type(
                        Executor, options.get("executor", {}), default_constructor=ThreadedExecutor
                    ),
                )
                for name, options in backends.items()
            },
            resolve_callable(selector_func),
            resolve_callable(callback_func) if callback_func is not None else None,
        )

    def validate(self) -> None:
        for backend, executor in self.backends.values():
            backend.validate()

    def setup(self) -> None:
        for backend, executor in self.backends.values():
            backend.setup()


KeyFetch = Callable[[Context, str, Mapping[str, Any]], str | int]


def make_writebehind_selector(
    *, option_name: str, key_fetch: KeyFetch, move_to: str, move_from: str
) -> Selector:
    """
    Generates a selector_func that will do write-behind delegation

    The provided option_name is expected to have values between -1 and 1

    -1.0 - 0.01 The move_from will be primary, while move_to will increasingly be added as a secondary.
    At 0.0 - Only move_from will be used.
    0.01 - 1.0 The move_to will increasingly be used as primary.

    The `key_fetch` function gets the parameters expected by `Selector` and
    is expected to return a consistent str|int that will be hashed for consistent
    rollouts. If no consistent key exists you can use random number generation.

    The `move_to` and `move_from` parameters should match the keys used to defined
    the backends in the `ServiceDelegator` configuration.

    Example:

    selector = make_writebehind_selector(
        option_name="feature.rollout",
        move_to="new",
        move_from="old",
        key_fetch=lambda *args: "a-consistent-key",
    )
    """

    def selector(context: Context, method: str, callargs: Mapping[str, Any]) -> list[str]:
        rollout_rate = options.get(option_name)
        if rollout_rate == 0.0:
            return [move_from]

        key = key_fetch(context, method, callargs)
        if isinstance(key, str):
            intkey = int(hashlib.md5(key.encode("utf8")).hexdigest(), base=16)
        else:
            intkey = key

        assert isinstance(intkey, int), intkey

        if rollout_rate < 0:
            if (intkey % 10000) / 10000 < rollout_rate * -1.0:
                return [move_from, move_to]
            return [move_from]
        else:
            # rollout > 0
            if (intkey % 10000) / 10000 < rollout_rate:
                return [move_to, move_from]

        return [move_from, move_to]

    return selector
