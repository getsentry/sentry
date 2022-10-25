import random
from datetime import datetime, timedelta
from typing import Sequence

from django.utils import timezone

from sentry.testutils import SnubaTestCase


class PerfIssueTransactionTestMixin:
    def store_transaction(
        self: SnubaTestCase,
        project_id: int,
        user_id: str,
        fingerprint: Sequence[str],
        environment: str = None,
        timestamp: datetime = None,
    ):
        from sentry.utils import snuba

        # truncate microseconds since there's some loss in precision
        insert_time = (timestamp if timestamp else timezone.now()).replace(microsecond=0)

        user_id_val = f"id:{user_id}"

        event_data = {
            "type": "transaction",
            "level": "info",
            "message": "transaction message",
            "tags": [("sentry:user", user_id_val)],
            "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
            "timestamp": insert_time.timestamp(),
            "start_timestamp": insert_time.timestamp(),
            "received": insert_time.timestamp(),
            # we need to randomize the value here to make sure ingestion doesn't dedupe these transactions
            "transaction": "transaction: " + str(insert_time) + str(random.randint(0, 100000000)),
            "fingerprint": fingerprint,
        }

        if environment:
            event_data["environment"] = environment
            event_data["tags"].extend([("environment", environment)])

        event = self.store_event(
            data=event_data,
            project_id=project_id,
        )

        # read the transaction back and verify it was successfully written to snuba
        result = snuba.raw_query(
            dataset=snuba.Dataset.Transactions,
            start=insert_time - timedelta(days=1),
            end=insert_time + timedelta(days=1),
            selected_columns=[
                "event_id",
                "project_id",
                "environment",
                "group_ids",
                "tags[sentry:user]",
                "timestamp",
            ],
            groupby=None,
            filter_keys={"project_id": [project_id], "event_id": [event.event_id]},
            referrer="_insert_transaction.verify_transaction",
        )
        assert len(result["data"]) == 1
        assert result["data"][0]["project_id"] == project_id
        assert result["data"][0]["group_ids"] == [g.id for g in event.groups]
        assert result["data"][0]["tags[sentry:user]"] == user_id_val
        assert result["data"][0]["environment"] == (environment)
        assert result["data"][0]["timestamp"] == insert_time.isoformat()

        return event
