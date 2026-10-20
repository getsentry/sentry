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
