from __future__ import absolute_import

import collections
import warnings


class WarningManager(object):
    """
    Transforms warnings into a standard form and invokes handlers.
    """
    def __init__(self, handlers, default_category=Warning):
        self.__handlers = handlers
        self.__default_category = default_category

    def warn(self, message, category=None, stacklevel=None):
        if isinstance(message, Warning):
            # Maybe log if `category` was passed and isn't a subclass of
            # `type(message)`?
            warning = message
        else:
            if category is None:
                category = self.__default_category

            assert issubclass(category, Warning)
            warning = category(message)

        kwargs = {}
        if stacklevel is not None:
            kwargs['stacklevel'] = stacklevel

        for handler in self.__handlers:
            handler(warning, **kwargs)


class WarningSet(collections.Set):
    """
    Add-only set structure for storing unique warnings.
    """
    def __init__(self):
        self.__warnings = {}

    def __contains__(self, value):
        assert isinstance(value, Warning)
        return self.__get_key(value) in self.__warnings

    def __len__(self):
        return len(self.__warnings)

    def __iter__(self):
        return self.__warnings.itervalues()

    def __get_key(self, warning):
        return (
            type(warning),
            warning.args if hasattr(warning, 'args') else str(warning),
        )

    def add(self, warning, stacklevel=None):
        self.__warnings[self.__get_key(warning)] = warning


# Maintains all unique warnings seen since system startup.
seen_warnings = WarningSet()

manager = WarningManager((
    lambda warning, stacklevel=1: warnings.warn(
        warning,
        stacklevel=stacklevel + 2,
    ),
    seen_warnings.add,
))

# Make this act like the standard library ``warnings`` module.
warn = manager.warn
