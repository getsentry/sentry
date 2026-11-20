import pytest


# There must be at least one migrations test or the suite fails. It also requests every
# database, so migration-test-db.py can run it to build the test databases.
@pytest.mark.migrations
@pytest.mark.django_db(databases="__all__")
def test_noop() -> None:
    pass
