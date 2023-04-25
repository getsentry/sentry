from typing import Any, Callable
from unittest.mock import MagicMock, patch

from django.http import HttpRequest
from rest_framework.request import Request
from sentry_sdk import Scope

from sentry.testutils import TestCase
from sentry.utils.sdk import (
    capture_exception_with_scope_check,
    check_current_scope_transaction,
    check_tag,
    merge_context_into_scope,
)


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


class CheckScopeTransactionTest(TestCase):
    @patch("sentry.utils.sdk.LEGACY_RESOLVER.resolve", return_value="/dogs/{name}/")
    def test_scope_has_correct_transaction(self, mock_resolve: MagicMock):
        mock_scope = Scope()
        mock_scope._transaction = "/dogs/{name}/"

        with patch("sentry.utils.sdk.configure_scope") as mock_configure_scope:
            set_mock_context_manager_return_value(mock_configure_scope, as_value=mock_scope)

            mismatch = check_current_scope_transaction(Request(HttpRequest()))
            assert mismatch is None

    @patch("sentry.utils.sdk.LEGACY_RESOLVER.resolve", return_value="/dogs/{name}/")
    def test_scope_has_wrong_transaction(self, mock_resolve: MagicMock):
        mock_scope = Scope()
        mock_scope._transaction = "/tricks/{trick_name}/"

        with patch("sentry.utils.sdk.configure_scope") as mock_configure_scope:
            set_mock_context_manager_return_value(mock_configure_scope, as_value=mock_scope)

            mismatch = check_current_scope_transaction(Request(HttpRequest()))
            assert mismatch == {
                "scope_transaction": "/tricks/{trick_name}/",
                "request_transaction": "/dogs/{name}/",
            }

    @patch("sentry.utils.sdk.LEGACY_RESOLVER.resolve", return_value="/dogs/{name}/")
    def test_custom_transaction_name(self, mock_resolve: MagicMock):
        mock_scope = Scope()
        mock_scope._transaction = "/tricks/{trick_name}/"
        mock_scope._transaction_info["source"] = "custom"

        with patch("sentry.utils.sdk.configure_scope") as mock_configure_scope:
            set_mock_context_manager_return_value(mock_configure_scope, as_value=mock_scope)

            mismatch = check_current_scope_transaction(Request(HttpRequest()))
            # custom transaction names shouldn't be flagged even if they don't match
            assert mismatch is None


@patch("sentry_sdk.capture_exception")
class CaptureExceptionTest(TestCase):
    def test_passes_along_exception(self, mock_sdk_capture_exception: MagicMock):
        err = Exception()

        with patch("sentry.utils.sdk.check_current_scope_transaction", return_value=None):
            capture_exception_with_scope_check(err)

        assert mock_sdk_capture_exception.call_args.args[0] == err

    @patch("sentry.utils.sdk.check_current_scope_transaction")
    def test_doesnt_check_transaction_if_no_request(
        self,
        mock_check_transaction: MagicMock,
        mock_sdk_capture_exception: MagicMock,
    ):
        capture_exception_with_scope_check(Exception())

        assert mock_check_transaction.call_count == 0

    def test_no_transaction_mismatch(self, mock_sdk_capture_exception: MagicMock):
        with patch("sentry.utils.sdk.check_current_scope_transaction", return_value=None):
            capture_exception_with_scope_check(Exception(), request=Request(HttpRequest()))

        passed_scope = mock_sdk_capture_exception.call_args.kwargs["scope"]

        assert isinstance(passed_scope, Scope)
        assert "scope_bleed.transaction" not in passed_scope._tags
        assert "scope_bleed" not in passed_scope._contexts

    def test_with_transaction_mismatch(self, mock_sdk_capture_exception: MagicMock):
        scope_bleed_data = {
            "scope_transaction": "/tricks/{trick_name}/",
            "request_transaction": "/dogs/{name}/",
        }

        with patch(
            "sentry.utils.sdk.check_current_scope_transaction", return_value=scope_bleed_data
        ):
            capture_exception_with_scope_check(Exception(), request=Request(HttpRequest()))

        passed_scope = mock_sdk_capture_exception.call_args.kwargs["scope"]

        assert isinstance(passed_scope, Scope)
        assert passed_scope._tags["scope_bleed.transaction"] is True
        assert passed_scope._contexts["scope_bleed"] == scope_bleed_data

    def test_no_scope_data_passed(self, mock_sdk_capture_exception: MagicMock):
        capture_exception_with_scope_check(Exception())

        passed_scope = mock_sdk_capture_exception.call_args.kwargs["scope"]
        empty_scope = Scope()

        for entry in empty_scope.__slots__:
            # No new scope data should be passed
            assert getattr(passed_scope, entry) == getattr(empty_scope, entry)

    def test_passes_along_incoming_scope_object(self, mock_sdk_capture_exception: MagicMock):
        incoming_scope_arg = Scope()

        capture_exception_with_scope_check(Exception(), scope=incoming_scope_arg)

        passed_scope = mock_sdk_capture_exception.call_args.kwargs["scope"]

        assert passed_scope == incoming_scope_arg

    def test_merges_incoming_scope_obj_and_args(self, mock_sdk_capture_exception: MagicMock):
        incoming_scope_arg = Scope()
        incoming_scope_arg.set_level("info")

        capture_exception_with_scope_check(
            Exception(), scope=incoming_scope_arg, fingerprint="pawprint"
        )

        passed_scope = mock_sdk_capture_exception.call_args.kwargs["scope"]

        assert passed_scope._level == "info"
        assert passed_scope._fingerprint == "pawprint"

    def test_passes_along_incoming_scope_args(self, mock_sdk_capture_exception: MagicMock):
        capture_exception_with_scope_check(Exception(), fingerprint="pawprint")

        passed_scope = mock_sdk_capture_exception.call_args.kwargs["scope"]

        assert passed_scope._fingerprint == "pawprint"

    def test_doesnt_overwrite_incoming_scope_bleed_context(
        self, mock_sdk_capture_exception: MagicMock
    ):
        existing_scope_bleed_data = {
            "previous_org.slug_tag": "good_dogs",
            "new_org.slug_tag": "squirrel_chasers",
        }
        transaction_scope_bleed_data = {
            "scope_transaction": "/tricks/{trick_name}/",
            "request_transaction": "/dogs/{name}/",
        }
        incoming_scope_arg = Scope()
        incoming_scope_arg.set_context("scope_bleed", existing_scope_bleed_data)

        with patch(
            "sentry.utils.sdk.check_current_scope_transaction",
            return_value=transaction_scope_bleed_data,
        ):
            capture_exception_with_scope_check(
                Exception(), request=Request(HttpRequest()), scope=incoming_scope_arg
            )

        passed_scope = mock_sdk_capture_exception.call_args.kwargs["scope"]

        # both old and new data should be included
        assert "previous_org.slug_tag" in passed_scope._contexts["scope_bleed"]
        assert "new_org.slug_tag" in passed_scope._contexts["scope_bleed"]
        assert "scope_transaction" in passed_scope._contexts["scope_bleed"]
        assert "request_transaction" in passed_scope._contexts["scope_bleed"]
