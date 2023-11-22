import pytest

from sentry import options
from sentry.models.counter import Counter
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import region_silo_test


@django_db_all
@pytest.mark.parametrize("upsert_sample_rate", [0, 1])
@region_silo_test
def test_increment(default_project, upsert_sample_rate):
    options.set("store.projectcounter-modern-upsert-sample-rate", upsert_sample_rate)

    assert Counter.increment(default_project, 42) == 42
    assert Counter.increment(default_project, 1) == 43
