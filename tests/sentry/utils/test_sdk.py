from typing import Any, Callable
from unittest.mock import MagicMock, patch

from sentry_sdk import Scope

from sentry.testutils import TestCase
from sentry.utils.sdk import check_tag, merge_context_into_scope


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


class SDKUtilsTest(TestCase):
    def test_context_scope_merge_no_existing_context(self):
        scope = Scope()
        new_context_data = {"maisey": "silly", "charlie": "goofy"}

        assert "dogs" not in scope._contexts

        merge_context_into_scope("dogs", new_context_data, scope)

        assert "dogs" in scope._contexts
        assert scope._contexts["dogs"] == new_context_data

    def test_context_scope_merge_with_existing_context(self):
        scope = Scope()
        existing_context_data = {"cory": "nudgy", "bodhi": "floppy"}
        new_context_data = {"maisey": "silly", "charlie": "goofy"}
        scope.set_context("dogs", existing_context_data)

        assert "dogs" in scope._contexts

        merge_context_into_scope("dogs", new_context_data, scope)

        assert scope._contexts["dogs"] == {
            "cory": "nudgy",
            "bodhi": "floppy",
            "maisey": "silly",
            "charlie": "goofy",
        }


@patch("sentry.utils.sdk.logger.warning")
class CheckTagTest(TestCase):
    def test_no_exiting_tag(self, mock_logger_warning: MagicMock):
        mock_scope = Scope()
        mock_scope._tags = {}

        with patch("sentry.utils.sdk.configure_scope") as mock_configure_scope:
            set_mock_context_manager_return_value(mock_configure_scope, as_value=mock_scope)
            check_tag("org.slug", "squirrel_chasers")

        assert "possible_mistag" not in mock_scope._tags
        assert "scope_bleed.tag.org.slug" not in mock_scope._tags
        assert "scope_bleed" not in mock_scope._contexts
        assert mock_logger_warning.call_count == 0

    def test_matching_exiting_tag(self, mock_logger_warning: MagicMock):
        mock_scope = Scope()
        mock_scope._tags = {"org.slug": "squirrel_chasers"}

        with patch("sentry.utils.sdk.configure_scope") as mock_configure_scope:
            set_mock_context_manager_return_value(mock_configure_scope, as_value=mock_scope)
            check_tag("org.slug", "squirrel_chasers")

        assert "possible_mistag" not in mock_scope._tags
        assert "scope_bleed.tag.org.slug" not in mock_scope._tags
        assert "scope_bleed" not in mock_scope._contexts
        assert mock_logger_warning.call_count == 0

    def test_different_exiting_tag(self, mock_logger_warning: MagicMock):
        mock_scope = Scope()
        mock_scope._tags = {"org.slug": "good_dogs"}

        with patch("sentry.utils.sdk.configure_scope") as mock_configure_scope:
            set_mock_context_manager_return_value(mock_configure_scope, as_value=mock_scope)
            check_tag("org.slug", "squirrel_chasers")

        extra = {
            "previous_org.slug_tag": "good_dogs",
            "new_org.slug_tag": "squirrel_chasers",
        }
        assert "possible_mistag" in mock_scope._tags
        assert "scope_bleed.org.slug" in mock_scope._tags
        assert mock_scope._contexts["scope_bleed"] == extra
        mock_logger_warning.assert_called_with(
            "Tag already set and different (org.slug).", extra=extra
        )
