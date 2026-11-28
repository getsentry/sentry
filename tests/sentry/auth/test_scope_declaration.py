from unittest import mock

from rest_framework.permissions import AllowAny

from sentry.auth.scope_declaration import (
    bind_endpoint_scope_declaration,
    check_scope_declaration,
    update_permission_scope_declaration,
)
from sentry.testutils.helpers.options import override_options


class AdmissionPermission(AllowAny):
    scope_map = {"POST": ("project:write",)}
    checked_scope_map = {"POST": ("org:admin",)}


@mock.patch("sentry.auth.scope_declaration.capture_message")
def test_checked_scopes_are_audited_as_declared(capture_message: mock.MagicMock) -> None:
    with (
        override_options({"api.permission-scope-audit.enabled": True}),
        bind_endpoint_scope_declaration(
            endpoint="test", method="POST", permission_classes=(AdmissionPermission,)
        ),
    ):
        # org:admin is declared as checked, and implies org:write via the hierarchy.
        check_scope_declaration("org:admin")
        check_scope_declaration("org:write")

    capture_message.assert_not_called()


@mock.patch("sentry.auth.scope_declaration.capture_message")
def test_checked_scopes_survive_scope_map_updates(capture_message: mock.MagicMock) -> None:
    permission = AdmissionPermission()
    with (
        override_options({"api.permission-scope-audit.enabled": True}),
        bind_endpoint_scope_declaration(
            endpoint="test", method="POST", permission_classes=(permission,)
        ),
    ):
        update_permission_scope_declaration(permission, {"POST": ("alerts:write",)})
        check_scope_declaration("org:admin")

    capture_message.assert_not_called()


@mock.patch("sentry.auth.scope_declaration.capture_message")
def test_checked_scopes_do_not_cover_other_scopes(capture_message: mock.MagicMock) -> None:
    with (
        override_options({"api.permission-scope-audit.enabled": True}),
        bind_endpoint_scope_declaration(
            endpoint="test", method="POST", permission_classes=(AdmissionPermission,)
        ),
    ):
        check_scope_declaration("member:admin")

    capture_message.assert_called_once_with("api.permission_scope.undeclared", level="warning")
