from __future__ import absolute_import

import inspect

from django.utils.functional import empty, LazyObject

from sentry.utils import warnings

from .imports import import_string


def extract_lazy_object(lo):
    """
    Unwrap a LazyObject and return the inner object. Whatever that may be.

    ProTip: This is relying on `django.utils.functional.empty`, which may
    or may not be removed in the future. It's 100% undocumented.
    """
    if not hasattr(lo, '_wrapped'):
        return lo
    if lo._wrapped is empty:
        lo._setup()
    return lo._wrapped


def apply_values(function, mapping):
    """\
    Applies ``function`` to a sequence containing all of the values in the
    provided mapping, returing a new mapping with the values replaced with
    the results of the provided function.

    >>> apply_values(
    ...   lambda values: map(u'{} fish'.format, values),
    ...   {1: 'red', 2: 'blue'},
    ... )
    {1: u'red fish', 2: u'blue fish'}
    """
    if not mapping:
        return {}

    keys, values = zip(*mapping.items())
    return dict(
        zip(
            keys,
            function(values),
        ),
    )


class LazyBackendWrapper(LazyObject):
    """
    Lazyily instantiates a standard Sentry backend class.

    >>> LazyBackendWrapper(BaseClass, 'path.to.import.Backend', {})

    Provides an ``expose`` method for dumping public APIs to a context, such as
    module locals:

    >>> backend = LazyBackendWrapper(...)
    >>> backend.expose(locals())
    """
    def __init__(self, backend_base, backend_path, options, dangerous=()):
        super(LazyBackendWrapper, self).__init__()
        self.__dict__.update({
            '_backend': backend_path,
            '_options': options,
            '_base': backend_base,
            '_dangerous': dangerous,
        })

    def __getattr__(self, name):
        if self._wrapped is empty:
            self._setup()
        return getattr(self._wrapped, name)

    def _setup(self):
        backend = import_string(self._backend)
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
        for key in base.__all__:
            if inspect.ismethod(getattr(base, key)):
                context[key] = (lambda f: lambda *a, **k: getattr(self, f)(*a, **k))(key)
            else:
                context[key] = getattr(base, key)
