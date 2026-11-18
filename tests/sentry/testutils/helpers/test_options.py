from contextlib import ExitStack
from unittest.mock import patch

from django.test import override_settings

from sentry import options
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_override_options_restores_nested_runtime_values() -> None:
    original = options.get("mail.timeout")
    with override_options({"mail.timeout": 20}):
        assert options.get("mail.timeout") == 20
        with override_options({"mail.timeout": 30}):
            assert options.get("mail.timeout") == 30
        assert options.get("mail.timeout") == 20
    assert options.get("mail.timeout") == original


@override_settings(SENTRY_SELF_HOSTED=False)
def test_override_options_reads_live_runtime_values() -> None:
    values: dict[str, object] = {"mail.timeout": 20}
    with override_options(values):
        assert options.get("mail.timeout") == 20
        values["mail.timeout"] = 30
        assert options.get("mail.timeout") == 30


@override_settings(SENTRY_SELF_HOSTED=False)
def test_override_options_preserves_read_hook_precedence() -> None:
    with (
        patch.object(options.default_manager, "_read_hook", return_value=42),
        override_options({"mail.timeout": 20}),
    ):
        assert options.get("mail.timeout") == 42


def test_override_options_survives_setup_settings_scope() -> None:
    with override_settings(), ExitStack() as cleanups:
        with override_settings(SENTRY_SELF_HOSTED=True):
            cleanups.enter_context(override_options({"mail.timeout": 20}))
        with override_settings(SENTRY_SELF_HOSTED=False):
            assert options.get("mail.timeout") == 20
            with override_options({"mail.timeout": 30}):
                assert options.get("mail.timeout") == 30
            assert options.get("mail.timeout") == 20
