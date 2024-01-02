import datetime
from uuid import uuid4

from django.urls import reverse

from sentry.replays.testutils import mock_replay, mock_replay_click
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.silo import region_silo_test

REPLAYS_FEATURES = {"organizations:session-replay": True}


@region_silo_test
class OrganizationReplayDetailsTest(APITestCase, ReplaysSnubaTestCase):
    endpoint = "sentry-api-0-project-replay-clicks-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.replay_id = uuid4().hex
        self.url = reverse(
            self.endpoint, args=(self.organization.slug, self.project.slug, self.replay_id)
        )

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_invalid_uuid_404s(self):
        with self.feature(REPLAYS_FEATURES):
            url = reverse(self.endpoint, args=(self.organization.slug, self.project.slug, "abc"))
            response = self.client.get(url)
            assert response.status_code == 404

    def test_get_replay_multiple_selectors(self):
        """Test only one replay returned."""
        replay1_id = self.replay_id
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay1_id))
        self.store_replays(
            mock_replay_click(
                seq1_timestamp,
                self.project.id,
                replay1_id,
                node_id=1,
                tag="div",
                id="myid",
                class_=["class1", "class2"],
                role="button",
                testid="1",
                alt="Alt",
                aria_label="AriaLabel",
                title="MyTitle",
                text="Hello",
            )
        )
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                self.project.id,
                replay1_id,
                node_id=2,
                tag="button",
                id="myid",
                alt="NotAlt",
                class_=["class1", "class3"],
            )
        )

        with self.feature(REPLAYS_FEATURES):
            # Assert a node was returned.
            response = self.client.get(self.url + "?query=click.tag:div click.tag:button")
            assert response.status_code == 200

            response_data = response.json()["data"]
            assert len(response_data) == 2
            assert response_data[0]["node_id"] == 1
            assert response_data[1]["node_id"] == 2

    def test_get_replays_filter_clicks(self):
        """Test replays conform to the interchange format."""
        replay1_id = self.replay_id
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay1_id))
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                self.project.id,
                replay1_id,
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
            )
        )
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                self.project.id,
                replay1_id,
                node_id=2,
                tag="button",
                id="id2",
                class_=["class1", "class3"],
            )
        )

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "click.alt:Alt",
                "click.class:class2",
                "click.class:class3",
                "click.id:id1",
                "click.label:AriaLabel",
                "click.role:button",
                "click.tag:div",
                "click.tag:button",
                "click.testid:1",
                "click.textContent:Hello",
                "click.title:MyTitle",
                "click.selector:div",
                "click.selector:div#id1",
                "click.selector:div[alt=Alt]",
                "click.selector:div[title=MyTitle]",
                "click.selector:div[data-testid='1']",
                "click.selector:div[role=button]",
                "click.selector:div#id1.class1.class2",
                # Single quotes around attribute value.
                "click.selector:div[role='button']",
                "click.selector:div#id1.class1.class2[role=button][aria-label='AriaLabel']",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?query={query}")
                assert response.status_code == 200, query
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

            queries = [
                "click.alt:NotAlt",
                "click.class:class4",
                "click.id:other",
                "click.label:NotAriaLabel",
                "click.role:form",
                "click.tag:header",
                "click.testid:2",
                "click.textContent:World",
                "click.title:NotMyTitle",
                # "!click.selector:div#myid",
                "click.selector:div#notmyid",
                # Assert all classes must match.
                "click.selector:div#myid.class1.class2.class3",
                # Invalid selectors return no rows.
                "click.selector:$#%^#%",
                # Integer type role values are not allowed and must be wrapped in single quotes.
                "click.selector:div[title=1]",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?query={query}")
                assert response.status_code == 200, query
                response_data = response.json()
                assert len(response_data["data"]) == 0, query

    def test_get_replays_filter_clicks_not_selector(self):
        replay1_id = self.replay_id
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay1_id))
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                self.project.id,
                replay1_id,
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
            )
        )
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                self.project.id,
                replay1_id,
                node_id=2,
                tag="button",
                id="id2",
                class_=["class1", "class3"],
            )
        )

        with self.feature(REPLAYS_FEATURES):
            # Assert `NOT` selectors match every click.
            response = self.client.get(self.url + "?query=!click.selector:div#myid")
            assert response.status_code == 200
            response_data = response.json()
            assert len(response_data["data"]) == 2

    def test_get_replay_explicit_and_to_implicit_or(self):
        """Test explicit AND operation are implicitly converted to OR operations."""
        replay1_id = self.replay_id
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay1_id))
        self.store_replays(
            mock_replay_click(
                seq1_timestamp,
                self.project.id,
                replay1_id,
                node_id=1,
                tag="div",
                id="myid",
                class_=["class1", "class2"],
                role="button",
                testid="1",
                alt="Alt",
                aria_label="AriaLabel",
                title="MyTitle",
                text="Hello",
            )
        )
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                self.project.id,
                replay1_id,
                node_id=2,
                tag="button",
                id="myid",
                alt="NotAlt",
                class_=["class1", "class3"],
            )
        )

        with self.feature(REPLAYS_FEATURES):
            # Explicit AND becomes logical OR
            response = self.client.get(self.url + "?query=click.tag:div AND click.tag:button")
            assert response.status_code == 200

            response_data = response.json()["data"]
            assert len(response_data) == 2
            assert response_data[0]["node_id"] == 1
            assert response_data[1]["node_id"] == 2

            # ParenExpression implicit AND becomes logical OR
            response = self.client.get(self.url + "?query=(click.tag:div click.tag:button)")
            assert response.status_code == 200

            response_data = response.json()["data"]
            assert len(response_data) == 2
            assert response_data[0]["node_id"] == 1
            assert response_data[1]["node_id"] == 2

            # ParenExpression explicit AND becomes logical OR
            response = self.client.get(self.url + "?query=(click.tag:div AND click.tag:button)")
            assert response.status_code == 200

            response_data = response.json()["data"]
            assert len(response_data) == 2
            assert response_data[0]["node_id"] == 1
            assert response_data[1]["node_id"] == 2

    def test_get_replays_invalid_filter_field(self):
        """Test invalid filter fields error."""
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?query=abc:123")
            assert response.status_code == 400
