import time
import uuid
from datetime import datetime, timedelta
from typing import Optional

from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.function import Function
from snuba_sdk.query import Query

from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils import snuba


class SnQLTest(TestCase, SnubaTestCase):
    def _insert_event_for_time(
        self, ts: datetime, group_hash: str = "a" * 32, group_id: Optional[int] = None
    ) -> str:
        event_id = uuid.uuid4().hex
        self.snuba_insert(
            (
                2,
                "insert",
                {
                    "event_id": event_id,
                    "primary_hash": group_hash,
                    "group_id": group_id if group_id else int(group_hash[:16], 16),
                    "project_id": self.project.id,
                    "message": "message",
                    "platform": "python",
                    "datetime": ts.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "data": {"received": time.mktime(ts.timetuple())},
                },
            )
        )
        return event_id

    def test_basic(self) -> None:
        now = datetime.now()
        self._insert_event_for_time(now)

        query = (
            Query(dataset="events", match=Entity("events"))
            .set_select([Function("count", [], "count")])
            .set_groupby([Column("project_id")])
            .set_where(
                [
                    Condition(Column("project_id"), Op.EQ, self.project.id),
                    Condition(Column("timestamp"), Op.GTE, now - timedelta(days=1)),
                    Condition(Column("timestamp"), Op.LT, now + timedelta(days=1)),
                ]
            )
        )

        result = snuba.raw_snql_query(query)
        assert len(result["data"]) == 1
        assert result["data"][0] == {"count": 1, "project_id": self.project.id}
