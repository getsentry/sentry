import pytest

from sentry.testutils.cases import TestMigrations


def test_migration_test_rejects_multiple_test_methods() -> None:
    with pytest.raises(TypeError, match="has 2 test methods"):

        class TwoTests(TestMigrations):
            def test_one(self) -> None:
                pass

            def test_two(self) -> None:
                pass


def test_migration_test_allows_multiple_test_methods_with_override() -> None:
    class TwoTests(TestMigrations):
        allow_multiple_tests = True

        def test_one(self) -> None:
            pass

        def test_two(self) -> None:
            pass


def test_migration_test_counts_inherited_test_methods() -> None:
    class Base(TestMigrations):
        def test_one(self) -> None:
            pass

    with pytest.raises(TypeError, match="has 2 test methods"):

        class Child(Base):
            def test_two(self) -> None:
                pass
