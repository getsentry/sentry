import pytest
from django.db import router, transaction

from sentry.hybridcloud.models.cacheversion import ControlCacheVersion
from sentry.models.options.option import ControlOption, Option
from sentry.testutils.control_row_locks import ControlRowLockError
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import cell_silo_test, control_silo_test


@django_db_all
@control_silo_test
def test_unlisted_row_lock_on_control_table_raises() -> None:
    option = ControlOption.objects.create(key="ctrl-63", value="x")

    with transaction.atomic(using=router.db_for_write(ControlOption)):
        with pytest.raises(ControlRowLockError) as excinfo:
            ControlOption.objects.select_for_update().filter(id=option.id).first()

    message = str(excinfo.value)
    assert "sentry_controloption" in message
    assert "test_unlisted_row_lock_on_control_table_raises" in message


@django_db_all
@control_silo_test
def test_queryset_row_lock_on_control_table_raises() -> None:
    option = ControlOption.objects.create(key="ctrl-63", value="x")

    with transaction.atomic(using=router.db_for_write(ControlOption)):
        with pytest.raises(ControlRowLockError):
            ControlOption.objects.filter(id=option.id).select_for_update().first()


@django_db_all
@control_silo_test
def test_update_or_create_on_control_table_raises() -> None:
    # Django's update_or_create takes the row lock itself, so the call site never
    # mentions select_for_update.
    with pytest.raises(ControlRowLockError):
        ControlOption.objects.update_or_create(key="ctrl-63", defaults={"value": "x"})


@django_db_all
@cell_silo_test
def test_row_lock_on_cell_table_is_allowed() -> None:
    option = Option.objects.create(key="ctrl-63", value="x")

    with transaction.atomic(using=router.db_for_write(Option)):
        assert Option.objects.select_for_update().filter(id=option.id).first() == option


@django_db_all
@control_silo_test
def test_plain_read_on_control_table_is_allowed() -> None:
    option = ControlOption.objects.create(key="ctrl-63", value="x")

    assert ControlOption.objects.filter(id=option.id).first() == option


@django_db_all
@control_silo_test
def test_allowlisted_row_lock_on_control_table_is_allowed() -> None:
    assert ControlCacheVersion.incr_version("ctrl-63") == 1
