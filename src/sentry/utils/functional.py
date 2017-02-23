from __future__ import absolute_import

from django.utils.functional import empty


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
