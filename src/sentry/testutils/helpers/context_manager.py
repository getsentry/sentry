from contextlib import contextmanager
from typing import Any, Callable
from unittest.mock import patch

from sentry_sdk import Scope


@contextmanager
def patch_configure_scope_with_scope(mocked_function_name: str, scope: Scope):
    with patch(mocked_function_name) as mock_configure_scope:
        mock_configure_scope.return_value.__enter__.return_value = scope

        yield mock_configure_scope


# TODO: This is kind of gross, but no other way seemed to work
def set_mock_context_manager_return_value(
    context_manager_constructor: Callable, as_value: Any
) -> None:
    """
    Ensure that if the code being tested includes something like

        with some_func() as some_value:

    then `some_value` will equal `as_value`.

    Note: `context_manager_constructor` should be `some_func`, not `some_func()`.
    """

    context_manager_constructor.return_value.__enter__.return_value = as_value
