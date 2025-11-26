from uuid import uuid4

import pytest

from sentry.testutils.cases import ReplaysSnubaTestCase
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsReplaysEndpointTest(
    OrganizationEventsEndpointTestBase, ReplaysSnubaTestCase
):
    dataset = "replays"

    def setUp(self) -> None:
        super().setUp()
        self.features = {
            "organizations:session-replay": True,
        }

    @pytest.mark.querybuilder
    def test_simple(self) -> None:
        replay_ids = [uuid4().hex, uuid4().hex]
        self.store_replays(
            [
                self.create_replay(self.ten_mins_ago, replay_id=replay_id)
                for replay_id in replay_ids
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["id"],
                "query": "",
                "orderby": "-id",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        for replay_id in replay_ids:
            assert replay_id in [row["id"] for row in data]
