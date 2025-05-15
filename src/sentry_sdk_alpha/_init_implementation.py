from typing import TYPE_CHECKING

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import ClientConstructor
from sentry_sdk_alpha.opentelemetry.scope import setup_scope_context_management

if TYPE_CHECKING:
    from typing import Any, Optional


def _check_python_deprecations():
    # type: () -> None
    # Since we're likely to deprecate Python versions in the future, I'm keeping
    # this handy function around. Use this to detect the Python version used and
    # to output logger.warning()s if it's deprecated.
    pass


def _init(*args, **kwargs):
    # type: (*Optional[str], **Any) -> None
    """Initializes the SDK and optionally integrations.

    This takes the same arguments as the client constructor.
    """
    setup_scope_context_management()
    client = sentry_sdk_alpha.Client(*args, **kwargs)
    sentry_sdk_alpha.get_global_scope().set_client(client)
    _check_python_deprecations()


if TYPE_CHECKING:
    # Make mypy, PyCharm and other static analyzers think `init` is a type to
    # have nicer autocompletion for params.
    #
    # Use `ClientConstructor` to define the argument types of `init` and
    # `ContextManager[Any]` to tell static analyzers about the return type.

    class init(ClientConstructor):  # noqa: N801
        pass

else:
    # Alias `init` for actual usage. Go through the lambda indirection to throw
    # PyCharm off of the weakly typed signature (it would otherwise discover
    # both the weakly typed signature of `_init` and our faked `init` type).

    init = (lambda: _init)()
