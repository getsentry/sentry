from collections import deque

from sentry.utils import json
from sentry.utils.functional import compact


class Faux:
    """
    Convenience functions for testing, and asserting, with ``unittest.mock``
    objects.

    Usage:
        >>> with patch('module.ClassName.func') as mock:
        >>>     ClassName.func('foo', extra={'bar': {'baz': 1}})
        >>>
        >>>     assert faux(mock).args == ('foo',)
        >>>     assert faux(mock).args_contain('foo')
        >>>     assert faux(mock).kwargs_contain('extra')
        >>>     assert faux(mock).kwargs_contain('extra.bar')
        >>>     assert faux(mock).kwarg_equals('extra.bar.baz', 1)

    Dot Notation:
        Functions that deal with ``kwargs`` will accept a dot notation
        shorthand for dealing with deeply nested ``dict`` keys.

        >>> with patch('module.ClassName.func') as mock:
        >>>     ClassName.func('foo', extra={'bar': {'baz': 1}})
        >>>
        >>>     assert faux(mock).kwargs_contain('extra.foo.baz')
        >>>     assert faux(mock).kwarg_equals('extra.foo.baz', 1)

    Multiple Calls
        By default, ``faux`` will select the last call to a ``mock``. You can
        specify which call you want by passing the index as a second parameter.

        >>> with patch('module.ClassName.func') as mock:
        >>>     ClassName.func('foo', extra={'bar': {'baz': 1}})
        >>>     ClassName.func(None)
        >>>
        >>>     assert faux(mock).args == (None,)
        >>>     assert faux(mock, 0).args == ('foo',)
    """

    def __init__(self, call):
        self.call = call

    @property
    def args(self):
        return self.call[1]

    @property
    def kwargs(self):
        return self.call[2]

    def called_with(self, *args, **kwargs):
        if self.args == tuple(args) and self.kwargs == kwargs:
            return True

        raise AssertionError(
            "Expected to be called with {}. Received {}.".format(
                self._invocation_to_s(*args, **kwargs),
                self._invocation_to_s(*self.args, **self.kwargs),
            )
        )

    def kwargs_contain(self, key, **kwargs):
        if self._kwarg_exists(key, **kwargs):
            return True

        raise AssertionError(
            "Expected kwargs to contain key '{}'. Received ({}).".format(
                key, self._kwargs_to_s(**self.kwargs)
            )
        )

    def kwarg_equals(self, key, expected, **kwargs):
        actual = self._kwarg_value(key, **kwargs)

        if actual == expected:
            return True

        raise AssertionError(f"Expected kwargs[{key}] to equal {expected!r}. Received {actual!r}.")

    def args_contain(self, value, **kwargs):
        if value in self.args:
            return True

        raise AssertionError(
            "Expected args to contain {!r}. Received ({}).".format(
                value, self._args_to_s(*self.args)
            )
        )

    def args_equals(self, *args, **kwargs):
        if self.args == tuple(args):
            return True

        raise AssertionError(
            "Expected args to equal ({}). Received ({}).".format(
                self._args_to_s(*args), self._args_to_s(*self.args)
            )
        )

    def _kwarg_exists(self, key):
        try:
            self._kwarg_value(key)
            return True
        except (KeyError, TypeError):
            return False

    def _kwarg_value(self, key, **kwargs):
        """
        Support a dot notation shortcut for deeply nested dicts or just look
        up the value if passed a normal key.

        >>> self.kwargs = {'foo': {'bar': {'baz': 1}}}
        >>> self._kwarg_value('foo.bar.baz')
        1
        >>> self._kwarg_value('foo')
        {'bar': {'baz': 1}}
        """
        if "." in key:
            keys = deque(key.split("."))
        else:
            kwarg = self.kwargs[key]

            if kwargs.get("format") == "json":
                return json.loads(kwarg)

            return kwarg

        kwarg = dict(self.kwargs)

        if kwargs.get("format") == "json":
            kwarg = json.loads(kwarg[keys.popleft()])

        while keys:
            kwarg = kwarg[keys.popleft()]

        return kwarg

    def _invocation_to_s(self, *args, **kwargs):
        """
        Convert a function invocation into a pretty printable string.
        """
        return "({})".format(
            ", ".join(compact([self._args_to_s(*args), self._kwargs_to_s(**kwargs)]))
        )

    def _args_to_s(self, *args):
        if not len(args):
            return None
        return ", ".join(f"{arg!r}" for arg in args)

    def _kwargs_to_s(self, **kwargs):
        if not len(kwargs):
            return None
        return ", ".join(f"{k}={v!r}" for k, v in kwargs.items())


class Mock:
    def __init__(self, *args, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def faux(mock, call=None):
    if call is not None:
        return Faux(mock.mock_calls[call])
    else:
        return Faux(mock.mock_calls[-1])
