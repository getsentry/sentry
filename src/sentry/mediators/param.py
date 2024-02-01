from __future__ import annotations

from typing import TYPE_CHECKING, Callable, Generic, Literal, TypeVar, overload

from typing_extensions import Self

C = TypeVar("C")
T = TypeVar("T")


class Param(Generic[T]):
    """
    Argument declarations for Mediators.

    Params offer a way to validate the arguments passed to a Mediator as well
    as set defaults.

    Example Usage:
        >>> class Creator(Mediator):
        >>>     name = Param(str, default='example')
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
        TypeError: `name` must be a <type 'str'>

    Type Validation:
        When a Mediator is instantiated, it validates each of it's Params. This
        mainly checks that the type of object passed in matches what we
        expected.

        >>> class Creator(Mediator):
        >>>     name = Param(str)
        >>>
        >>> c = Creator(name=False)
        Traceback (most recent call last):
            ...
        TypeError: `name` must be a <type 'str'>

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
        >>>     name = Param(str, default='Pete')
        >>>
        >>> c = Creator()
        >>> c.name
        'Pete'

        >>> class Creator(Mediator):
        >>>     user = Param(dict)
        >>>     name = Param(str, default=lambda self: self.user['name'])
    """

    @overload
    def __init__(
        self: Param[T | None],
        type: type[T],
        *,
        required: Literal[False],
        default: T | Callable[..., T] | None = None,
    ) -> None:
        ...

    @overload
    def __init__(
        self: Param[T],
        type: type[T],
        *,
        required: bool = ...,
        default: T | Callable[..., T] | None = None,
    ) -> None:
        ...

    def __init__(
        self,
        type: type[T],
        *,
        default: T | Callable[..., T] | None = None,
        required: bool = True,
    ) -> None:
        self.type = type
        self._default = default
        self.is_required = required
        self.has_default = default is not None

    def setup(self, target, name):
        delattr(target, name)
        setattr(target, f"_{name}", self)

    def validate(self, target, name, value):
        """
        Ensure the value evaluated is present (when required) and of the
        correct type.
        """
        if value is None:
            value = self.default(target)

        if self._missing_value(value):
            raise AttributeError(f"Missing required param: `{name}`")

        if self.is_required and not isinstance(value, self.type):
            raise TypeError(f"`{name}` must be a {self.type}, received {type(value)}")

        return True

    def default(self, target):
        """
        Evaluated default value, when given.
        """
        default = value = self._default

        if callable(default):
            value = default(target)

        return value

    def _missing_value(self, value):
        return self.is_required and value is None and not self.has_default

    # these act as attributes after Mediator does its metaprogramming
    if TYPE_CHECKING:

        @overload
        def __get__(self, inst: None, owner: type[C]) -> Self:
            ...

        @overload
        def __get__(self, inst: C, owner: type[C]) -> T:
            ...

        def __get__(self, inst: C | None, owner: type[C]) -> T | Self:
            ...
