from __future__ import absolute_import

import functools
import inspect
import itertools
import logging

from collections import OrderedDict
from django.utils.functional import empty, LazyObject

from sentry.utils import warnings
from sentry.utils.concurrent import FutureSet, ThreadedExecutor

from .imports import import_string


logger = logging.getLogger(__name__)


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

    def __init__(self, backend_base, backend_path, options, dangerous=()):
        super(LazyServiceWrapper, self).__init__()
        self.__dict__.update(
            {
                '_backend': backend_path,
                '_options': options,
                '_base': backend_base,
                '_dangerous': dangerous,
            }
        )

    def __getattr__(self, name):
        if self._wrapped is empty:
            self._setup()
        return getattr(self._wrapped, name)

    def _setup(self):
        backend = import_string(self._backend)
        assert issubclass(backend, Service)
        if backend in self._dangerous:
            warnings.warn(
                warnings.UnsupportedBackend(
                    u'The {!r} backend for {} is not recommended '
                    'for production use.'.format(self._backend, self._base)
                )
            )
        instance = backend(**self._options)
        self._wrapped = instance

    def expose(self, context):
        base = self._base
        for key in itertools.chain(base.__all__, ('validate', 'setup')):
            if inspect.ismethod(getattr(base, key)):
                context[key] = (lambda f: lambda *a, **k: getattr(self, f)(*a, **k))(key)
            else:
                context[key] = getattr(base, key)


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

    The backends used for a method call are determined by a selector function.
    The return value of the selector function is a list of strings, which
    correspond to names in the backend mapping. The first item in the result
    list is considered the "primary backend". The remainder of the items in the
    result list are considered "secondary backends". The result value of the
    primary backend will be the result value of the delegated method (to
    callers, this appears as a synchronous method call.) The secondary backends
    are called asynchronously in the background. (To receive the result values
    of these method calls, provide a callback_func, described below.) If the
    primary backend name returned by the selector function doesn't correspond
    to any registered backend, the function will raise a ``InvalidBackend``
    exception. If any referenced secondary backends are not registered names,
    they will be discarded and logged.

    The selector function and callback function are both provided as paths to a
    callable that will be imported at backend instantation.

    Implementation notes:

    - Only method access is delegated to the individual backends. Attribute
      values are returned from the base backend. Only methods that are defined
      on the base backend are eligble for delegation (since these methods are
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
      successfully or unsuccessfully. The function is parameters are the method
      name, calling arguments (as returned by ``inspect.getcallargs``) and a
      mapping of backend name to ``Future`` objects.
    """

    class InvalidBackend(Exception):
        """\
        Exception raised when an invalid backend is returned by a selector
        function.
        """

    def __init__(self, backend_base, backends, selector_func, callback_func=None):
        self.__backend_base = import_string(backend_base)

        def load_executor(options):
            path = options.get('path')
            if path is None:
                executor_cls = ThreadedExecutor
            else:
                executor_cls = import_string(path)
            return executor_cls(**options.get('options', {}))

        self.__backends = {}
        for name, options in backends.items():
            self.__backends[name] = (
                import_string(options['path'])(**options.get('options', {})),
                load_executor(options.get('executor', {})),
            )

        self.__selector_func = import_string(selector_func)

        if callback_func is not None:
            self.__callback_func = import_string(callback_func)
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
            # Binding the call arguments to named arguments has two benefits:
            # 1. These values always be passed in the same form to the selector
            #    function and callback, regardless of how they were passed to
            #    the method itself (as positional arguments, keyword arguments,
            #    etc.)
            # 2. This ensures that the given arguments are those supported by
            #    the base backend itself, which should be a common subset of
            #    arguments that are supported by all backends.
            callargs = inspect.getcallargs(base_value, None, *args, **kwargs)

            results = OrderedDict()
            for i, backend_name in enumerate(self.__selector_func(attribute_name, callargs)):
                is_primary = i == 0
                try:
                    backend, executor = self.__backends[backend_name]
                except KeyError:
                    if is_primary:
                        raise self.InvalidBackend(
                            '{!r} is not a registered backend.'.format(backend_name))
                    else:
                        logger.warning(
                            '%r is not a registered backend and will be ignored.',
                            backend_name,
                            exc_info=True)
                        continue

                results[backend_name] = executor.submit(
                    functools.partial(getattr(backend, attribute_name), *args, **kwargs),
                    block=is_primary,
                )

            if self.__callback_func is not None:
                FutureSet(results.values()).add_done_callback(
                    lambda *a, **k: self.__callback_func(attribute_name, callargs, results)
                )

            return results.values()[0].result()

        return execute
