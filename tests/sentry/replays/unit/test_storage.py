import pytest
from django.conf import settings

from sentry import options
from sentry.replays.lib.storage import (
    FilestoreBlob,
    StorageBlob,
    _make_storage_driver,
    make_storage_driver,
)


def test_make_storage_driver_allow_list():
    """Test building storage driver instance from allow-list."""
    # Organization exists in the allow-list.
    assert isinstance(_make_storage_driver(1, 0, [1]), StorageBlob)

    # Organization does not exist in the allow-list.
    assert isinstance(_make_storage_driver(1, 0, []), FilestoreBlob)
    assert isinstance(_make_storage_driver(1, 0, [2]), FilestoreBlob)


def test_make_storage_driver_sample_rate():
    """Test building storage driver instance from sample rate."""
    # organization_id = 50
    # organization_id % 100 == 50
    # 50% is the sample-rate threshold before this org is allowed to participate.
    assert isinstance(_make_storage_driver(50, 0, []), FilestoreBlob)
    assert isinstance(_make_storage_driver(50, 10, []), FilestoreBlob)
    assert isinstance(_make_storage_driver(50, 20, []), FilestoreBlob)
    assert isinstance(_make_storage_driver(50, 30, []), FilestoreBlob)
    assert isinstance(_make_storage_driver(50, 40, []), FilestoreBlob)
    assert isinstance(_make_storage_driver(50, 49, []), FilestoreBlob)
    assert isinstance(_make_storage_driver(50, 50, []), FilestoreBlob)
    assert isinstance(_make_storage_driver(50, 51, []), StorageBlob)
    assert isinstance(_make_storage_driver(50, 60, []), StorageBlob)
    assert isinstance(_make_storage_driver(50, 70, []), StorageBlob)
    assert isinstance(_make_storage_driver(50, 80, []), StorageBlob)
    assert isinstance(_make_storage_driver(50, 90, []), StorageBlob)
    assert isinstance(_make_storage_driver(50, 100, []), StorageBlob)

    # 0% sample rate means no org should ever be allowed to participate.
    assert isinstance(_make_storage_driver(0, 0, []), FilestoreBlob)


def test_sentry_replays_storage_allow_list_default_value():
    """Test "SENTRY_REPLAYS_STORAGE_ALLOWLIST" default value."""
    allow_list = settings.SENTRY_REPLAYS_STORAGE_ALLOWLIST
    assert allow_list == []


@pytest.mark.django_db
def test_make_storage_driver():
    """Test "make_storage_driver" returns FilestoreBlob without further configuration."""
    options.set("replay.storage.direct-storage-sample-rate", 0)
    assert isinstance(make_storage_driver(0), FilestoreBlob)
    assert isinstance(make_storage_driver(10), FilestoreBlob)
    assert isinstance(make_storage_driver(20), FilestoreBlob)
    assert isinstance(make_storage_driver(30), FilestoreBlob)
    assert isinstance(make_storage_driver(40), FilestoreBlob)
    assert isinstance(make_storage_driver(50), FilestoreBlob)
    assert isinstance(make_storage_driver(60), FilestoreBlob)
    assert isinstance(make_storage_driver(70), FilestoreBlob)
    assert isinstance(make_storage_driver(80), FilestoreBlob)
    assert isinstance(make_storage_driver(90), FilestoreBlob)
    assert isinstance(make_storage_driver(100), FilestoreBlob)
