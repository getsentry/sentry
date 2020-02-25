from __future__ import absolute_import

import functools
import inspect
import itertools
import logging
import threading

import six
from django.utils.functional import empty, LazyObject

from sentry.utils import warnings, metrics
from sentry.utils.concurrent import FutureSet, ThreadedExecutor

from .imports import import_string


logger = logging.getLogger(__name__)


def raises(exceptions):
    def decorator(function):
        function.__raises__ = exceptions
        return function

    return decorator


class Service(object):
    __all__ = ()

    def validate(self):
        """
        Validates the settings for this backend (i.e. such as proper connection
        info).

        Raise ``InvalidConfiguration`` if there is a configuration error.
        """

    def setup(self):
        """
        Initialize this service.
        """


class LazyServiceWrapper(LazyObject):
    """
    Lazyily instantiates a standard Sentry service class.

    >>> LazyServiceWrapper(BaseClass, 'path.to.import.Backend', {})

    Provides an ``expose`` method for dumping public APIs to a context, such as
    module locals:

    >>> service = LazyServiceWrapper(...)
    >>> service.expose(locals())
    """

    def __init__(self, backend_base, backend_path, options, dangerous=(), metrics_path=None):
        super(LazyServiceWrapper, self).__init__()
        self.__dict__.update(
            {
                "_backend": backend_path,
                "_options": options,
                "_base": backend_base,
                "_dangerous": dangerous,
                "_metrics_path": metrics_path,
            }
        )

    def __getattr__(self, name):
        if self._wrapped is empty:
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

    def _setup(self):
        backend = import_string(self._backend)
        assert issubclass(backend, Service)
        if backend in self._dangerous:
            warnings.warn(
                warnings.UnsupportedBackend(
                    u"The {!r} backend for {} is not recommended "
                    "for production use.".format(self._backend, self._base)
                )
            )
        instance = backend(**self._options)
        self._wrapped = instance

    def expose(self, context):
        base = self._base
        base_instance = base()
        for key in itertools.chain(base.__all__, ("validate", "setup")):
            if inspect.ismethod(getattr(base_instance, key)):
                context[key] = (lambda f: lambda *a, **k: getattr(self, f)(*a, **k))(key)
            else:
                context[key] = getattr(base_instance, key)


def resolve_callable(value):
    if callable(value):
        return value
    elif isinstance(value, six.string_types):
        return import_string(value)
    else:
        raise TypeError("Expected callable or string")


class Context(object):
    def __init__(self, request, backends):
        self.request = request
        self.backends = backends

    def copy(self):
        return Context(self.request, self.backends.copy())


class ServiceDelegator(Service):
    """\
    This is backend that coordinates and delegates method execution to multiple
    backends. It can be used to route requests to different backends based on
    method arguments, as well as execute the same request against multiple
    backends in parallel for testing backend performance and data consistency.

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

    The backends used for a method call are determined by a selector function
    which is provided with the current context, the method name (as a string)
    and arguments (in the form returned by ``inspect.getcallargs``) and
    expected to return a list of strings which correspond to names in the
    backend mapping. (This list should contain at least one member.) The first
    item in the result list is considered the "primary backend". The remainder
    of the items in the result list are considered "secondary backends". The
    result value of the primary backend will be the result value of the
    delegated method (to callers, this appears as a synchronous method call.)
    The secondary backends are called asynchronously in the background.  (To
    receive the result values of these method calls, provide a callback_func,
    described below.) If the primary backend name returned by the selector
    function doesn't correspond to any registered backend, the function will
    raise a ``InvalidBackend`` exception.  If any referenced secondary backends
    are not registered names, they will be discarded and logged.

    The members and ordering of the selector function result (and thus the
    primary and secondary backends for a method call) may vary from call to
    call based on the calling arguments or some other state. For example, some
    calls may use a different primary backend based on some piece of global
    state (e.g. some property of a web request), or a secondary backend
    undergoing testing may be included based on the result of a random number
    generator (essentially calling it in the background for a sample of calls.)

    The selector function and callback function can be provided as either:

    - A dotted import path string (``path.to.callable``) that will be
      imported at backend instantiation, or
    - A reference to a callable object.

    Implementation notes:

    - Only method access is delegated to the individual backends. Attribute
      values are returned from the base backend. Only methods that are defined
      on the base backend are eligible for delegation (since these methods are
      considered the public API.)
    - The backend makes no attempt to synchronize common backend option values
      between backends (e.g. TSDB rollup configuration) to ensure equivalency
      of request parameters based on configuration.
    - Each backend is associated with an executor pool which defaults to a
      thread pool implementation unless otherwise specified in the backend
      configuration. If the backend itself is not thread safe (due to socket
      access, etc.), it's recommended to specify a pool size of 1 to ensure
      exclusive access to resources. Each executor is started when the first
      task is submitted.
    - The request is added to the request queue of the primary backend using a
      blocking put. The request is added to the request queue(s) of the
      secondary backend(s) as a non-blocking put (if these queues are full, the
      request is rejected and the future will raise ``Queue.Full`` when
      attempting to retrieve the result.)
    - The ``callback_func`` is called after all futures have completed, either
      successfully or unsuccessfully. The function parameters are:
      - the context,
      - the method name (as a string),
      - the calling arguments (as returned by ``inspect.getcallargs``),
      - the backend names (as returned by the selector function),
      - a list of results (as either a ``Future``, or ``None`` if the backend
        was invalid) of the same length and ordering as the backend names.
    """

    class InvalidBackend(Exception):
        """\
        Exception raised when an invalid backend is returned by a selector
        function.
        """

    class State(threading.local):
        def __init__(self):
            self.context = None

    __state = State()

    def __init__(self, backend_base, backends, selector_func, callback_func=None):
        self.__backend_base = import_string(backend_base)

        def load_executor(options):
            path = options.get("path")
            if path is None:
                executor_cls = ThreadedExecutor
            else:
                executor_cls = import_string(path)
            return executor_cls(**options.get("options", {}))

        self.__backends = {}
        for name, options in backends.items():
            self.__backends[name] = (
                import_string(options["path"])(**options.get("options", {})),
                load_executor(options.get("executor", {})),
            )

        self.__selector_func = resolve_callable(selector_func)

        if callback_func is not None:
            self.__callback_func = resolve_callable(callback_func)
        else:
            self.__callback_func = None

    def validate(self):
        for backend, executor in self.__backends.values():
            backend.validate()

    def setup(self):
        for backend, executor in self.__backends.values():
            backend.setup()

    def __getattr__(self, attribute_name):
        # When deciding how to handle attribute accesses, we have three
        # different possible outcomes:
        # 1. If this is defined as a method on the base implementation, we are
        #    able delegate it to the backends based on the selector function.
        # 2. If this is defined as an attribute on the base implementation, we
        #    are able to (immediately) return that as the value. (This also
        #    mirrors the behavior of ``LazyServiceWrapper``, which will cache
        #    any attribute access during ``expose``, so we can't delegate
        #    attribute access anyway.)
        # 3. If this isn't defined at all on the base implementation, we let
        #    the ``AttributeError`` raised by ``getattr`` propagate (mirroring
        #    normal attribute access behavior for a missing/invalid name.)
        base_value = getattr(self.__backend_base, attribute_name)
        if not inspect.ismethod(base_value):
            return base_value

        def execute(*args, **kwargs):
            context = type(self).__state.context

            # If there is no context object already set in the thread local
            # state, we are entering the delegator for the first time and need
            # to create a new context.
            if context is None:
                from sentry.app import env  # avoids a circular import

                context = Context(env.request, {})

            # If this thread already has an active backend for this base class,
            # we can safely call that backend synchronously without delegating.
            if self.__backend_base in context.backends:
                backend = context.backends[self.__backend_base]
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

            selected_backend_names = list(self.__selector_func(context, attribute_name, callargs))
            if not len(selected_backend_names) > 0:
                raise self.InvalidBackend("No backends returned by selector!")

            # Ensure that the primary backend is actually registered -- we
            # don't want to schedule any work on the secondaries if the primary
            # request is going to fail anyway.
            if selected_backend_names[0] not in self.__backends:
                raise self.InvalidBackend(
                    u"{!r} is not a registered backend.".format(selected_backend_names[0])
                )

            def call_backend_method(context, backend, is_primary):
                # Update the thread local state in the executor to the provided
                # context object. This allows the context to be propagated
                # across different threads.
                assert type(self).__state.context is None
                type(self).__state.context = context

                # Ensure that we haven't somehow accidentally entered a context
                # where the backend we're calling has already been marked as
                # active (or worse, some other backend is already active.)
                base = self.__backend_base
                assert base not in context.backends

                # Mark the backend as active.
                context.backends[base] = backend
                try:
                    return getattr(backend, attribute_name)(*args, **kwargs)
                except Exception as e:
                    # If this isn't the primary backend, we log any unexpected
                    # exceptions so that they don't pass by unnoticed. (Any
                    # exceptions raised by the primary backend aren't logged
                    # here, since it's assumed that the caller will log them
                    # from the calling thread.)
                    if not is_primary:
                        expected_raises = getattr(base_value, "__raises__", [])
                        if not expected_raises or not isinstance(e, tuple(expected_raises)):
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
            results = [None] * len(selected_backend_names)
            for i, backend_name in enumerate(selected_backend_names[1:], 1):
                try:
                    backend, executor = self.__backends[backend_name]
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
            backend, executor = self.__backends[selected_backend_names[0]]
            results[0] = executor.submit(
                functools.partial(call_backend_method, context.copy(), backend, is_primary=True),
                priority=0,
                block=True,
            )

            if self.__callback_func is not None:
                FutureSet([_f for _f in results if _f]).add_done_callback(
                    lambda *a, **k: self.__callback_func(
                        context, attribute_name, callargs, selected_backend_names, results
                    )
                )

            return results[0].result()

        return execute
