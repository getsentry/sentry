import unittest
from typing import Any
from unittest.mock import Mock

import pytest
from django.conf import settings
from django.test import override_settings

from sentry.silo.base import SiloMode
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import (
    _SiloModeTestModification,
    strip_silo_mode_test_suffix,
    validate_protected_queries,
)


@pytest.mark.parametrize("silo_mode", list(SiloMode))
def test_silo_mode_covers_teardown_and_cleanup(silo_mode: SiloMode) -> None:
    observed = []

    class LifecycleTest(unittest.TestCase):
        def setUp(self) -> None:
            observed.append(("setup", SiloMode.get_current_mode()))
            self.addCleanup(lambda: observed.append(("cleanup", SiloMode.get_current_mode())))

        def runTest(self) -> None:
            observed.append(("test", SiloMode.get_current_mode()))

        def tearDown(self) -> None:
            observed.append(("teardown", SiloMode.get_current_mode()))

        def doCleanups(self) -> Any:
            observed.append(("doCleanups", SiloMode.get_current_mode()))
            return super().doCleanups()

    modification = _SiloModeTestModification(frozenset([silo_mode]), ())
    test_class = modification._create_overriding_test_class(LifecycleTest, silo_mode)
    original_mode = SiloMode.get_current_mode()
    result = unittest.TestResult()
    test_class().run(result)

    assert result.wasSuccessful(), (result.errors, result.failures)
    assert observed == [
        (phase, silo_mode) for phase in ("setup", "test", "teardown", "doCleanups", "cleanup")
    ]
    assert SiloMode.get_current_mode() == original_mode


@pytest.mark.parametrize(
    ("failure_phase", "error", "expected_errors"),
    [
        ("setup", None, 0),
        ("setup", RuntimeError("setup failed"), 1),
        ("test", RuntimeError("test failed"), 1),
        ("teardown", RuntimeError("teardown failed"), 1),
        ("cleanup", RuntimeError("cleanup failed"), 1),
    ],
)
def test_silo_mode_restored_after_options_cleanup(
    failure_phase: str, error: RuntimeError | None, expected_errors: int
) -> None:
    callbacks = {phase: Mock() for phase in ("setup", "test", "teardown", "cleanup")}
    callbacks[failure_phase].side_effect = error

    class OptionsTest(unittest.TestCase):
        def setUp(self) -> None:
            self.enterContext(override_options({"test.silo-cleanup": True}))
            self.addCleanup(callbacks["cleanup"])
            callbacks["setup"]()

        def runTest(self) -> None:
            callbacks["test"]()

        def tearDown(self) -> None:
            callbacks["teardown"]()

    modification = _SiloModeTestModification(frozenset([SiloMode.CONTROL]), ())
    test_class = modification._create_overriding_test_class(OptionsTest, SiloMode.CONTROL)
    # Bound the reproduction so a regression cannot poison the rest of this suite.
    with override_settings(SILO_MODE=SiloMode.CELL):
        original_options = settings.SENTRY_OPTIONS
        result = unittest.TestResult()
        test_class().run(result)

        assert len(result.errors) == expected_errors, result.errors
        assert not result.failures, result.failures
        callbacks["cleanup"].assert_called_once_with()
        assert SiloMode.get_current_mode() == SiloMode.CELL
        assert settings.SENTRY_OPTIONS is original_options


def test_validate_protected_queries__no_queries() -> None:
    validate_protected_queries([])


def test_validate_protected_queries__ok() -> None:
    queries = [
        {"sql": "SELECT * FROM sentry_organization"},
        {"sql": "UPDATE sentry_project SET slug = 'best-team' WHERE id = 1"},
    ]
    validate_protected_queries(queries)


def test_validate_protected_queries__missing_fences() -> None:
    queries = [
        {"sql": 'SAVEPOINT "s123abc"'},
        {"sql": 'UPDATE "sentry_useremail" SET "is_verified" = true WHERE "id" = 1'},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'oops\' WHERE "id" = 1'},
        {"sql": 'UPDATE "sentry_project" SET "slug" = \'frontend\' WHERE "id" = 3'},
    ]
    with pytest.raises(AssertionError):
        validate_protected_queries(queries)


def test_validate_protected_queries__with_single_fence() -> None:
    queries = [
        {"sql": 'SAVEPOINT "s123abc"'},
        {"sql": 'UPDATE "sentry_useremail" SET "is_verified" = true WHERE "id" = 1'},
        {"sql": "SELECT 'start_role_override_1'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'oops\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_1'"},
        {"sql": 'UPDATE "sentry_project" SET "slug" = \'frontend\' WHERE "id" = 3'},
    ]
    validate_protected_queries(queries)


def test_validate_protected_queries__multiple_fences() -> None:
    queries = [
        {"sql": 'SAVEPOINT "s123abc"'},
        {"sql": 'UPDATE "sentry_useremail" SET "is_verified" = true WHERE "id" = 1'},
        {"sql": "SELECT 'start_role_override_1'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'oops\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_1'"},
        {"sql": 'UPDATE "sentry_project" SET "slug" = \'frontend\' WHERE "id" = 3'},
        {"sql": "SELECT 'start_role_override_2'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'another-oops\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_2'"},
    ]
    validate_protected_queries(queries)


def test_validate_protected_queries__nested_fences() -> None:
    queries = [
        {"sql": 'SAVEPOINT "s123abc"'},
        {"sql": 'UPDATE "sentry_useremail" SET "is_verified" = true WHERE "id" = 1'},
        {"sql": "SELECT 'start_role_override_1'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'safe\' WHERE "id" = 1'},
        # Nested role overrides shouldn't happen but we need to handle them just in case.
        {"sql": "SELECT 'start_role_override_2'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'also-safe\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_2'"},
        {"sql": "SELECT 'end_role_override_1'"},
        {"sql": 'UPDATE "sentry_project" SET "slug" = \'frontend\' WHERE "id" = 3'},
        {"sql": 'UPDATE "sentry_organizationmemberteam" SET "role" = \'member\' WHERE "id" = 3'},
    ]
    validate_protected_queries(queries)

    queries = [
        {"sql": 'SAVEPOINT "s123abc"'},
        {"sql": 'UPDATE "sentry_useremail" SET "is_verified" = true WHERE "id" = 1'},
        {"sql": "SELECT 'start_role_override_1'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'safe\' WHERE "id" = 1'},
        # Nested role overrides shouldn't happen but we need to handle them just in case.
        {"sql": "SELECT 'start_role_override_2'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'also-safe\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_2'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'still-safe\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_1'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'not-safe\' WHERE "id" = 1'},
    ]
    with pytest.raises(AssertionError):
        validate_protected_queries(queries)


def test_validate_protected_queries__fenced_and_not() -> None:
    queries = [
        {"sql": 'SAVEPOINT "s123abc"'},
        {"sql": 'UPDATE "sentry_useremail" SET "is_verified" = true WHERE "id" = 1'},
        {"sql": "SELECT 'start_role_override_1'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'oops\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_1'"},
        {"sql": 'UPDATE "sentry_project" SET "slug" = \'frontend\' WHERE "id" = 3'},
        # This query is lacking fences
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'another-oops\' WHERE "id" = 1'},
    ]
    with pytest.raises(AssertionError):
        validate_protected_queries(queries)


def test_strip_silo_mode_test_suffix() -> None:
    assert strip_silo_mode_test_suffix("SomeTest") == "SomeTest"
    assert strip_silo_mode_test_suffix("SomeTest__InMonolithMode") == "SomeTest"
    assert strip_silo_mode_test_suffix("SomeTest__InControlMode") == "SomeTest"
    assert strip_silo_mode_test_suffix("SomeTest__InCellMode") == "SomeTest"
    assert strip_silo_mode_test_suffix("SomeTest__InAnotherMode") == "SomeTest__InAnotherMode"
