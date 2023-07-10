import pytest

from sentry.testutils.silo import validate_protected_queries


def test_validate_protected_queries__no_queries():
    assert validate_protected_queries([]) is None


def test_validate_protected_queries__ok():
    queries = [
        {"sql": "SELECT * FROM sentry_organization"},
        {"sql": "UPDATE sentry_team SET slug = 'best-team' WHERE id = 1"},
    ]
    assert validate_protected_queries(queries) is None


def test_validate_protected_queries__missing_fences():
    queries = [
        {"sql": 'SAVEPOINT "s123abc"'},
        {"sql": 'UPDATE "sentry_useremail" SET "is_verified" = true WHERE "id" = 1'},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'oops\' WHERE "id" = 1'},
        {"sql": 'UPDATE "sentry_team" SET "slug" = \'frontend\' WHERE "id" = 3'},
    ]
    with pytest.raises(AssertionError):
        validate_protected_queries(queries)


def test_validate_protected_queries__with_single_fence():
    queries = [
        {"sql": 'SAVEPOINT "s123abc"'},
        {"sql": 'UPDATE "sentry_useremail" SET "is_verified" = true WHERE "id" = 1'},
        {"sql": "SELECT 'start_role_override_1'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'oops\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_1'"},
        {"sql": 'UPDATE "sentry_team" SET "slug" = \'frontend\' WHERE "id" = 3'},
    ]
    assert validate_protected_queries(queries) is None


def test_validate_protected_queries__multiple_fences():
    queries = [
        {"sql": 'SAVEPOINT "s123abc"'},
        {"sql": 'UPDATE "sentry_useremail" SET "is_verified" = true WHERE "id" = 1'},
        {"sql": "SELECT 'start_role_override_1'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'oops\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_1'"},
        {"sql": 'UPDATE "sentry_team" SET "slug" = \'frontend\' WHERE "id" = 3'},
        {"sql": "SELECT 'start_role_override_2'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'another-oops\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_2'"},
    ]
    assert validate_protected_queries(queries) is None


def test_validate_protected_queries__nested_fences():
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
        {"sql": 'UPDATE "sentry_team" SET "slug" = \'frontend\' WHERE "id" = 3'},
    ]
    assert validate_protected_queries(queries) is None

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


def test_validate_protected_queries__fenced_and_not():
    queries = [
        {"sql": 'SAVEPOINT "s123abc"'},
        {"sql": 'UPDATE "sentry_useremail" SET "is_verified" = true WHERE "id" = 1'},
        {"sql": "SELECT 'start_role_override_1'"},
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'oops\' WHERE "id" = 1'},
        {"sql": "SELECT 'end_role_override_1'"},
        {"sql": 'UPDATE "sentry_team" SET "slug" = \'frontend\' WHERE "id" = 3'},
        # This query is lacking fences
        {"sql": 'UPDATE "sentry_organization" SET "slug" = \'another-oops\' WHERE "id" = 1'},
    ]
    with pytest.raises(AssertionError):
        validate_protected_queries(queries)
