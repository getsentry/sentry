from django.utils.functional import empty

from sentry.utils.compat import zip


def extract_lazy_object(lo):
    """
    Unwrap a LazyObject and return the inner object. Whatever that may be.

    ProTip: This is relying on `django.utils.functional.empty`, which may
    or may not be removed in the future. It's 100% undocumented.
    """
    if not hasattr(lo, "_wrapped"):
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
    return dict(zip(keys, function(values)))


def compact(seq):
    """
    Removes ``None`` values from various sequence-based data structures.

    dict:
        Removes keys with a corresponding ``None`` value.

    list:
        Removes ``None`` values.

    >>> compact({'foo': 'bar', 'baz': None})
    {'foo': 'bar'}

    >>> compact([1, None, 2])
    [1, 2]
    """
    if isinstance(seq, dict):
        return {k: v for k, v in seq.items() if v is not None}

    elif isinstance(seq, list):
        return [k for k in seq if k is not None]


def cached(cache, function, *args, **kwargs):
    """Calls ``function`` or retrieves its return value from the ``cache``.

    This is similar to ``functools.cache``, but uses a custom cache instead
    of a global one. The cache can be shared between multiple functions.
    """
    key = (function, args, tuple(sorted(kwargs.items())))

    if key in cache:
        rv = cache[key]
    else:
        rv = cache[key] = function(*args)

    return rv
