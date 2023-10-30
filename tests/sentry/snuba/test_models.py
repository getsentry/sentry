from datetime import timedelta

from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class SnubaQueryEventTypesTest(TestCase):
    def test(self):
        snuba_query = create_snuba_query(
            SnubaQuery.Type.ERROR,
            Dataset.Events,
            "release:123",
            "count()",
            timedelta(minutes=10),
            timedelta(minutes=1),
            None,
            [SnubaQueryEventType.EventType.DEFAULT, SnubaQueryEventType.EventType.ERROR],
        )
        assert set(snuba_query.event_types) == {
            SnubaQueryEventType.EventType.DEFAULT,
            SnubaQueryEventType.EventType.ERROR,
        }
