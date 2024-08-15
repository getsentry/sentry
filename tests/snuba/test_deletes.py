import time
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from snuba_sdk import DeleteQuery, Request

from sentry.snuba.dataset import Dataset, StorageKey
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils import snuba


class SnubaTest(TestCase, SnubaTestCase):
    @pytest.mark.xfail
    def test_basic(self) -> None:
        # insert a new issue
        now = datetime.now()
        id = uuid4()
        issue = (
            2,
            "insert",
            {
                "group_id": 1,
                "message": "message",
                "platform": "python",
                "primary_hash": "1" * 32,
                "event_id": "a" * 32,
                "project_id": self.project.id,
                "datetime": now.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                "data": {"received": time.mktime(now.timetuple())},
                "occurrence_data": {
                    "detection_time": time.mktime(now.timetuple()),
                    "fingerprint": ["hi"],
                    "issue_title": "myissue",
                    "id": id,
                    "type": 1,
                },
                "organization_id": 6,
            },
        )
        self.store_issues([issue])

        # make sure its there
        assert snuba.query(
            dataset=Dataset.IssuePlatform,
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            groupby=["project_id"],
            filter_keys={"project_id": [self.project.id]},
            referrer="testing.test",
            tenant_ids={"referrer": "testing.test", "organization_id": 1},
        ) == {self.project.id: 1}

        # delete it
        req = Request(
            dataset=Dataset.IssuePlatform.value,
            app_id="my_app",
            query=DeleteQuery(
                StorageKey.SearchIssues.value,
                {"project_id": [self.project.id], "occurrence_id": [str(id)]},
            ),
            tenant_ids={"referrer": "testing.test", "organization_id": 1},
        )
        snuba.raw_snql_query(req)

        # make sure its gone
        time.sleep(5)  # test will currently fail without the sleep (maybe it take time to delete?)
        assert (
            snuba.query(
                dataset=Dataset.IssuePlatform,
                start=now - timedelta(days=1),
                end=now + timedelta(days=1),
                groupby=["project_id"],
                filter_keys={"project_id": [self.project.id]},
                referrer="testing.test",
                tenant_ids={"referrer": "testing.test", "organization_id": 1},
            )
            == {}
        )
