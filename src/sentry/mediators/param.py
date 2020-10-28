from __future__ import absolute_import

import six
import sys
import types

from sentry.utils.cache import memoize


class Param(object):
    """
    Argument declarations for Mediators.

    Params offer a way to validate the arguments passed to a Mediator as well
    as set defaults.

    Example Usage:
        >>> class Creator(Mediator):
        >>>     name = Param(six.binary_type, default='example')
        >>>
        >>> c = Creator(name='foo')
        >>> c.name
        'foo'

        >>> c = Creator()
        >>> c.name
        'example'

        >>> c = Creator(name=False)
        Traceback (most recent call last):
            ...
        TypeError: `name` must be a <type 'six.binary_type'>

    Type Validation:
        When a Mediator is instantiated, it validates each of it's Params. This
        mainly checks that the type of object passed in matches what we
        expected.

        >>> class Creator(Mediator):
        >>>     name = Param(six.binary_type)
        >>>
        >>> c = Creator(name=False)
        Traceback (most recent call last):
            ...
        TypeError: `name` must be a <type 'six.binary_type'>

    Presence Validation:
        Without specifying otherwise, Params are assumed to be required. If
        it's okay for specific param to be None or not passed at all, you can
        do so by declaring ``required=False``.

        >>> class Creator(Mediator):
        >>>     size = Param(int, required=False)
        >>>
        >>> c = Creator()
        >>> c.size
        None

    Default Value:
        You can set a default value using the ``default`` argument. Default
        values can be static ones like an int, string, etc. that get evaluated
        at import. Or they can be a ``lambda`` that gets evaluated when the
        Mediator is instantiated.

        Declaration order DOES matter.

        >>> class Creator(Mediator):
        >>>     name = Param(six.binary_type, default='Pete')
        >>>
        >>> c = Creator()
        >>> c.name
        'Pete'

        >>> class Creator(Mediator):
        >>>     user = Param(dict)
        >>>     name = Param(six.binary_type, default=lambda self: self.user['name'])
    """

    def __init__(self, type, **kwargs):
        self._type = type
        self.kwargs = kwargs

    def setup(self, target, name):
        delattr(target, name)
        setattr(target, u"_{}".format(name), self)

    def validate(self, target, name, value):
        """
        Ensure the value evaluated is present (when required) and of the
        correct type.
        """
        if value is None:
            value = self.default(target)

        if self._missing_value(value):
            raise AttributeError(u"Missing required param: `{}`".format(name))

        if self.is_required and not isinstance(value, self.type):
            raise TypeError(u"`{}` must be a {}, received {}".format(name, self.type, type(value)))

        return True

    def default(self, target):
        """
        Evaluated default value, when given.
        """
        default = value = self.kwargs.get("default")

        if self.is_lambda_default:
            value = default(target)

        return value

    @memoize
    def type(self):
        if isinstance(self._type, six.string_types):
            return self._eval_string_type()
        return self._type

    @memoize
    def has_default(self):
        return "default" in self.kwargs

    @memoize
    def is_lambda_default(self):
        return isinstance(self.kwargs.get("default"), types.LambdaType)

    @memoize
    def is_required(self):
        if self.kwargs.get("required") is False:
            return False
        return True

    def _eval_string_type(self):
        """
        Converts a class path in string form to the actual class object.

        Example:
            >>> self._type = 'sentry.models.Project'
            >>> self._eval_string_type()
            sentry.models.project.Project
        """
        mod, klass = self._type.rsplit(".", 1)
        return getattr(sys.modules[mod], klass)

    def _missing_value(self, value):
        return self.is_required and value is None and not self.has_default


def if_param(name):
    def _if_param(func):
        def wrapper(self, *args):
            if not hasattr(self, name) or getattr(self, name) is None:
                return
            return func(self, *args)

        return wrapper

    return _if_param
