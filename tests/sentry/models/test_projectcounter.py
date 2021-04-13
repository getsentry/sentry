import pytest

from sentry import options
from sentry.models import Counter


@pytest.mark.django_db
@pytest.mark.parametrize("upsert_sample_rate", [0, 1])
def test_increment(default_project, upsert_sample_rate):
    options.set("store.projectcounter-modern-upsert-sample-rate", upsert_sample_rate)

    assert Counter.increment(default_project, 42) == 42
    assert Counter.increment(default_project, 1) == 43
