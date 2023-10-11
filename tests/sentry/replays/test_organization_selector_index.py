import datetime
import uuid

from django.urls import reverse

from sentry.replays.testutils import mock_replay, mock_replay_click
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.silo import region_silo_test

REPLAYS_FEATURES = {"organizations:session-replay": True}


@region_silo_test
@apply_feature_flag_on_cls("organizations:global-views")
class OrganizationSelectorIndexTest(APITestCase, ReplaysSnubaTestCase):
    endpoint = "sentry-api-0-organization-replay-selectors-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_feature_flag_disabled(self):
        """Test replays can be disabled."""
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_no_projects(self):
        """Test replays must be used with a project(s)."""
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"] == []

    def test_get_replays(self):
        """Test replays conform to the interchange format."""
        project = self.create_project(teams=[self.team])

        replay_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, project.id, replay_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay_id))
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                project.id,
                replay_id,
                node_id=1,
                tag="div",
                id="myid",
                class_=["class1", "class2"],
                role="button",
                testid="1",
                alt="Alt",
                aria_label="AriaLabel",
                title="MyTitle",
                is_dead=1,
                is_rage=1,
                text="Hello",
            )
        )
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                project.id,
                replay_id,
                node_id=1,
                tag="div",
                id="myid",
                class_=["class1", "class2", ""],
                role="button",
                testid="1",
                alt="Alt",
                aria_label="AriaLabel",
                title="MyTitle",
                is_dead=1,
                is_rage=0,
                text="Hello",
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

            assert response_data["data"][0]["project_id"] == project.id
            assert (
                response_data["data"][0]["dom_element"]
                == 'div#myid.class1.class2[role="button"][alt="Alt"][testid="1"][aria="AriaLabel"][title="MyTitle"]'
            )
            assert response_data["data"][0]["count_dead_clicks"] == 2
            assert response_data["data"][0]["count_rage_clicks"] == 1
            assert response_data["data"][0]["element"]["alt"] == "Alt"
            assert response_data["data"][0]["element"]["aria_label"] == "AriaLabel"
            assert response_data["data"][0]["element"]["class"] == ["class1", "class2"]
            assert response_data["data"][0]["element"]["id"] == "myid"
            assert response_data["data"][0]["element"]["role"] == "button"
            assert response_data["data"][0]["element"]["tag"] == "div"
            assert response_data["data"][0]["element"]["testid"] == "1"
            assert response_data["data"][0]["element"]["title"] == "MyTitle"

    def test_get_replays_filter_clicks(self):
        """Test replays conform to the interchange format."""
        replay_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay_id))
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                self.project.id,
                replay_id,
                node_id=1,
                tag="div",
                id="id1",
                class_=["class1", "class2"],
                role="button",
                testid="1",
                alt="Alt",
                aria_label="AriaLabel",
                title="MyTitle",
                text="Hello",
                is_dead=True,
                is_rage=False,
            )
        )
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                self.project.id,
                replay_id,
                node_id=1,
                tag="div",
                id="id1",
                class_=["class1", "class2"],
                role="button",
                testid="1",
                alt="Alt",
                aria_label="AriaLabel",
                title="MyTitle",
                text="Hello",
                is_dead=True,
                is_rage=True,
            )
        )

        with self.feature(REPLAYS_FEATURES):
            queries = ["count_dead_clicks:2", "count_rage_clicks:1"]
            for query in queries:
                response = self.client.get(self.url + f"?query={query}")
                assert response.status_code == 200, query
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

            queries = ["count_dead_clicks:1", "count_rage_clicks:2"]
            for query in queries:
                response = self.client.get(self.url + f"?query={query}")
                assert response.status_code == 200, query
                response_data = response.json()
                assert len(response_data["data"]) == 0, query
