from unittest.mock import patch

import pytest
from django.db import router, transaction
from django.utils import timezone

from sentry.audit_log.services.log import UserIpEvent
from sentry.audit_log.services.log.impl import DatabaseBackedLogService
from sentry.hybridcloud.models.cacheversion import ControlCacheVersion
from sentry.models.options.option import ControlOption, Option
from sentry.testutils.control_row_locks import ControlRowLockError
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import cell_silo_test, control_silo_test

ALLOWLIST = "sentry.testutils.control_row_locks.ALLOWED_CONTROL_ROW_LOCKS"


@django_db_all
@control_silo_test
def test_unlisted_row_lock_on_control_table_raises() -> None:
    with patch.dict(ALLOWLIST, clear=True):
        with pytest.raises(ControlRowLockError) as excinfo:
            ControlCacheVersion.incr_version("ctrl-63")

    message = str(excinfo.value)
    assert "hybridcloud_controlcacheversion" in message
    assert "sentry.hybridcloud.models.cacheversion.CacheVersionBase.incr_version" in message


@django_db_all
@control_silo_test
def test_update_or_create_on_control_table_raises() -> None:
    # Django's update_or_create takes the row lock itself, so the call site never
    # mentions select_for_update.
    user = Factories.create_user()
    event = UserIpEvent(user_id=user.id, ip_address="127.0.0.1", last_seen=timezone.now())

    with patch.dict(ALLOWLIST, clear=True):
        with pytest.raises(ControlRowLockError) as excinfo:
            DatabaseBackedLogService().record_user_ip(event=event)

    assert "sentry_userip" in str(excinfo.value)


@django_db_all
@control_silo_test
def test_allowlisted_row_lock_on_control_table_is_allowed() -> None:
    assert ControlCacheVersion.incr_version("ctrl-63") == 1


@django_db_all
@control_silo_test
def test_row_lock_taken_by_test_code_is_ignored() -> None:
    option = ControlOption.objects.create(key="ctrl-63", value="x")

    with transaction.atomic(using=router.db_for_write(ControlOption)):
        assert ControlOption.objects.select_for_update().filter(id=option.id).first() == option


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
