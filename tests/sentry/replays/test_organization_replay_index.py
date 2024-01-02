import datetime
import uuid
from unittest import mock

import pytest
from django.urls import reverse

from sentry.replays.testutils import (
    assert_expected_response,
    mock_expected_response,
    mock_replay,
    mock_replay_click,
)
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.silo import region_silo_test
from sentry.utils.cursors import Cursor
from sentry.utils.snuba import QueryMemoryLimitExceeded

REPLAYS_FEATURES = {"organizations:session-replay": True}


@region_silo_test
@apply_feature_flag_on_cls("organizations:global-views")
class OrganizationReplayIndexTest(APITestCase, ReplaysSnubaTestCase):
    endpoint = "sentry-api-0-organization-replay-index"

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

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                project.id,
                replay1_id,
                # NOTE: This is commented out due to a bug in CI.  This will not affect
                # production use and have been verfied as working as of 08/10/2022.
                #
                # error_ids=[uuid.uuid4().hex, replay1_id],  # duplicate error-id
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],  # duplicate urls are okay,
                tags={"test": "hello", "other": "hello"},
                release="test",
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                project.id,
                replay1_id,
                # error_ids=[uuid.uuid4().hex, replay1_id],  # duplicate error-id
                urls=["http://localhost:3000/"],  # duplicate urls are okay
                tags={"test": "world", "other": "hello"},
                error_ids=[],
                release="",
            )
        )
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                project.id,
                replay1_id,
                node_id=1,
                tag="div",
                id="myid",
                class_=["class1", "class2"],
                component_name="SignUpForm",
                role="button",
                testid="1",
                alt="Alt",
                aria_label="AriaLabel",
                title="MyTitle",
                is_dead=1,
                is_rage=1,
                text="Hello",
                release=None,
            )
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp, project.id, "error", replay1_id, "a3a62ef6ac86415b83c2416fc2f76db1"
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

            # Assert the response body matches what was expected.
            expected_response = mock_expected_response(
                project.id,
                replay1_id,
                seq1_timestamp,
                seq2_timestamp,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                    "http://localhost:3000/",
                ],
                count_segments=2,
                # count_errors=3,
                count_errors=1,
                tags={"test": ["hello", "world"], "other": ["hello"]},
                activity=4,
                count_dead_clicks=1,
                count_rage_clicks=1,
                releases=["test"],
                clicks=[
                    {
                        "click.alt": "Alt",
                        "click.classes": ["class1", "class2"],
                        "click.id": "myid",
                        "click.component_name": "SignUpForm",
                        "click.role": "button",
                        "click.tag": "div",
                        "click.testid": "1",
                        "click.text": "Hello",
                        "click.title": "MyTitle",
                        "click.label": "AriaLabel",
                    }
                ],
            )
            assert_expected_response(response_data["data"][0], expected_response)

    def test_get_replays_browse_screen_fields(self):
        """Test replay response with fields requested in production."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                project.id,
                replay1_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],
                tags={"test": "hello", "other": "hello"},
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                project.id,
                replay1_id,
                urls=["http://localhost:3000/"],
                tags={"test": "world", "other": "hello"},
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(
                self.url
                + "?field=activity&field=count_errors&field=duration&field=finished_at&field=id"
                "&field=project_id&field=started_at&field=urls&field=user"
            )
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

            assert len(response_data["data"][0]) == 9
            assert "activity" in response_data["data"][0]
            assert "count_errors" in response_data["data"][0]
            assert "duration" in response_data["data"][0]
            assert "finished_at" in response_data["data"][0]
            assert "id" in response_data["data"][0]
            assert "project_id" in response_data["data"][0]
            assert "started_at" in response_data["data"][0]
            assert "urls" in response_data["data"][0]
            assert "user" in response_data["data"][0]

            assert len(response_data["data"][0]["user"]) == 5
            assert "id" in response_data["data"][0]["user"]
            assert "username" in response_data["data"][0]["user"]
            assert "email" in response_data["data"][0]["user"]
            assert "ip" in response_data["data"][0]["user"]
            assert "display_name" in response_data["data"][0]["user"]

    def test_get_replays_tags_field(self):
        """Test replay response with fields requested in production."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                project.id,
                replay1_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],
                tags={"test": "hello", "other": "hello"},
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                project.id,
                replay1_id,
                urls=["http://localhost:3000/"],
                tags={"test": "world", "other": "hello"},
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?field=tags")
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

            assert len(response_data["data"][0]) == 1
            assert "tags" in response_data["data"][0]
            assert sorted(response_data["data"][0]["tags"]["test"]) == ["hello", "world"]
            assert response_data["data"][0]["tags"]["other"] == ["hello"]

    def test_get_replays_minimum_field_set(self):
        """Test replay response with fields requested in production."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                project.id,
                replay1_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],
                tags={"test": "hello", "other": "hello"},
                user_id=123,
                replay_start_timestamp=int(seq1_timestamp.timestamp()),
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                project.id,
                replay2_id,
                urls=["http://localhost:3000/"],
                tags={"test": "world", "other": "hello"},
                replay_start_timestamp=int(seq1_timestamp.timestamp()),
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(
                self.url + "?field=id&sort=count_errors&query=test:hello OR user_id:123"
            )
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

            assert len(response_data["data"][0]) == 1
            assert "id" in response_data["data"][0]

    def test_get_replays_filter_environment(self):
        """Test returned replays can not partially fall outside of range."""
        project = self.create_project(teams=[self.team])

        self.create_environment(name="development", project=self.project)
        self.create_environment(name="production", project=self.project)

        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=20)
        timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=10)

        self.store_replays(
            mock_replay(timestamp0, project.id, replay1_id, environment="development")
        )
        self.store_replays(
            mock_replay(timestamp1, project.id, replay1_id, environment="development")
        )
        self.store_replays(
            mock_replay(timestamp0, project.id, replay2_id, environment="production")
        )
        self.store_replays(
            mock_replay(timestamp1, project.id, replay2_id, environment="production")
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?environment=development")
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"][0]["id"] == replay1_id

            response = self.client.get(self.url + "?environment=production")
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"][0]["id"] == replay2_id

    def test_get_replays_started_at_sorted(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=5)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=2)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # Latest first.
            response = self.client.get(self.url + "?sort=-started_at")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay2_id
            assert response_data["data"][1]["id"] == replay1_id

            # Earlist first.
            response = self.client.get(self.url + "?sort=started_at")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay1_id
            assert response_data["data"][1]["id"] == replay2_id

    def test_get_replays_finished_at_sorted(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=5)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=2)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # Latest first.
            response = self.client.get(self.url + "?sort=-finished_at")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay2_id
            assert response_data["data"][1]["id"] == replay1_id

            # Earlist first.
            response = self.client.get(self.url + "?sort=finished_at")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay1_id
            assert response_data["data"][1]["id"] == replay2_id

    def test_get_replays_duration_sorted(self):
        """Test replays can be sorted by duration."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=9)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=2)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # Smallest duration first.
            response = self.client.get(self.url + "?sort=duration")
            assert response.status_code == 200, response
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay1_id
            assert response_data["data"][1]["id"] == replay2_id

            # Largest duration first.
            response = self.client.get(self.url + "?sort=-duration")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay2_id
            assert response_data["data"][1]["id"] == replay1_id

    def test_get_replays_pagination(self):
        """Test replays can be paginated."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=5)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=2)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id, segment_id=0))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id, segment_id=1))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id, segment_id=0))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id, segment_id=1))

        with self.feature(REPLAYS_FEATURES):
            # First page.
            response = self.get_success_response(
                self.organization.slug,
                cursor=Cursor(0, 0),
                per_page=1,
            )
            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1
            assert response_data["data"][0]["id"] == replay2_id

            # Next page.
            response = self.get_success_response(
                self.organization.slug,
                cursor=Cursor(0, 1),
                per_page=1,
            )
            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1
            assert response_data["data"][0]["id"] == replay1_id

            # Beyond pages.
            response = self.get_success_response(
                self.organization.slug,
                cursor=Cursor(0, 2),
                per_page=1,
            )

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 0

    def test_get_replays_user_filters(self):
        """Test replays conform to the interchange format."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                project.id,
                replay1_id,
                platform="javascript",
                dist="abc123",
                user_id="123",
                user_email="username@example.com",
                user_name="username123",
                user_ip_address="127.0.0.1",
                sdk_name="sentry.javascript.react",
                sdk_version="6.18.10",
                os_name="macOS",
                os_version="15",
                browser_name="Firefox",
                browser_version="99",
                device_name="Macbook",
                device_brand="Apple",
                device_family="Macintosh",
                device_model="10",
                tags={"a": "m", "b": "q", "c": "test"},
                urls=["example.com"],
                segment_id=0,
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                project.id,
                replay1_id,
                user_id=None,
                user_name=None,
                user_email=None,
                ipv4=None,
                os_name=None,
                os_version=None,
                browser_name=None,
                browser_version=None,
                device_name=None,
                device_brand=None,
                device_family=None,
                device_model=None,
                tags={"a": "n", "b": "o"},
                error_ids=[],
                segment_id=1,
            )
        )
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "fatal", replay1_id, uuid.uuid4().hex)
        )
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "fatal", replay1_id, uuid.uuid4().hex)
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp, project.id, "error", replay1_id, "a3a62ef6ac86415b83c2416fc2f76db1"
            )
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp, project.id, "warning", replay1_id, uuid.uuid4().hex
            )
        )
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "info", replay1_id, uuid.uuid4().hex)
        )
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "debug", replay1_id, uuid.uuid4().hex)
        )

        with self.feature(REPLAYS_FEATURES):
            # Run all the queries individually to determine compliance.
            queries = [
                "replay_type:session",
                "error_ids:a3a62ef6ac86415b83c2416fc2f76db1",
                "error_id:a3a62ef6ac86415b83c2416fc2f76db1",
                "trace_ids:4491657243ba4dbebd2f6bd62b733080",
                "trace_id:4491657243ba4dbebd2f6bd62b733080",
                "trace:4491657243ba4dbebd2f6bd62b733080",
                "count_urls:1",
                "count_dead_clicks:0",
                "count_rage_clicks:0",
                "platform:javascript",
                "releases:version@1.3",
                "releases:[a,version@1.3]",
                "release:version@1.3",
                "release:[a,version@1.3]",
                "duration:17",
                "!duration:16",
                "duration:>16",
                "duration:<18",
                "duration:>=17",
                "duration:<=17",
                "duration:[16,17]",
                "!duration:[16,18]",
                "user.id:123",
                "user:username123",
                "user.username:username123",
                "user.email:username@example.com",
                "user.email:*@example.com",
                "user.ip:127.0.0.1",
                "sdk.name:sentry.javascript.react",
                "os.name:macOS",
                "os.version:15",
                "browser.name:Firefox",
                "browser.version:99",
                "dist:abc123",
                "releases:*3",
                "!releases:*4",
                "release:*3",
                "!release:*4",
                "count_segments:>=2",
                "device.name:Macbook",
                "device.brand:Apple",
                "device.family:Macintosh",
                "device.model:10",
                # Contains operator.
                f"id:[{replay1_id},{uuid.uuid4().hex},{uuid.uuid4().hex}]",
                f"!id:[{uuid.uuid4().hex}]",
                # Or expression.
                f"id:{replay1_id} OR id:{uuid.uuid4().hex} OR id:{uuid.uuid4().hex}",
                # Paren wrapped expression.
                f"((id:{replay1_id} OR id:b) AND (duration:>15 OR id:d))",
                # Implicit paren wrapped expression.
                f"(id:{replay1_id} OR id:b) AND (duration:>15 OR id:d)",
                # Implicit And.
                f"(id:{replay1_id} OR id:b) OR (duration:>15 platform:javascript)",
                # Tag filters.
                "tags[a]:m",
                "a:m",
                "c:*st",
                "!c:*zz",
                "urls:example.com",
                "url:example.com",
                "activity:3",
                "activity:>2",
                "count_warnings:1",
                "count_warnings:>0",
                "count_warnings:<2",
                "count_infos:2",
                "count_infos:>1",
                "count_infos:<3",
            ]

            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200, query
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

            # Test all queries as a single AND expression.
            all_queries = " ".join(queries)

            response = self.client.get(self.url + f"?query={all_queries}")
            assert response.status_code == 200
            response_data = response.json()
            assert len(response_data["data"]) == 1, "all queries"

            # Assert returns empty result sets.
            null_queries = [
                "!replay_type:session",
                "!error_ids:a3a62ef6ac86415b83c2416fc2f76db1",
                "error_ids:123",
                "!error_id:a3a62ef6ac86415b83c2416fc2f76db1",
                "error_id:123",
                "!trace_ids:4491657243ba4dbebd2f6bd62b733080",
                "!trace_id:4491657243ba4dbebd2f6bd62b733080",
                "!trace:4491657243ba4dbebd2f6bd62b733080",
                "count_urls:0",
                "count_dead_clicks:>0",
                "count_rage_clicks:>0",
                f"id:{replay1_id} AND id:b",
                f"id:{replay1_id} AND duration:>1000",
                "id:b OR duration:>1000",
                "a:o",
                "a:[o,p]",
                "releases:a",
                "releases:*4",
                "!releases:*3",
                "releases:[a,b]",
                "release:a",
                "release:*4",
                "!release:*3",
                "release:[a,b]",
                "c:*zz",
                "!c:*st",
                "!activity:3",
                "activity:<2",
            ]
            for query in null_queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200, query
                response_data = response.json()
                assert len(response_data["data"]) == 0, query

    def test_get_replays_user_sorts(self):
        """Test replays conform to the interchange format."""
        project = self.create_project(teams=[self.team])
        project2 = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=15)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                project2.id,
                replay1_id,
                error_ids=[uuid.uuid4().hex, uuid.uuid4().hex],
                platform="b",
                dist="b",
                user_id="b",
                user_email="b",
                user_name="b",
                user_ip_address="127.0.0.2",
                sdk_name="b",
                sdk_version="b",
                os_name="b",
                os_version="b",
                browser_name="b",
                browser_version="b",
                device_name="b",
                device_brand="b",
                device_family="b",
                device_model="b",
                segment_id=0,
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                project2.id,
                replay1_id,
                platform="b",
                dist="b",
                user_id="b",
                user_email="b",
                user_name="b",
                user_ip_address="127.0.0.2",
                sdk_name="b",
                sdk_version="b",
                os_name="b",
                os_version="b",
                browser_name="b",
                browser_version="b",
                device_name="b",
                device_brand="b",
                device_family="b",
                device_model="b",
                segment_id=1,
            )
        )

        replay2_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=15)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                project.id,
                replay2_id,
                error_ids=[uuid.uuid4().hex],
                platform="a",
                dist="a",
                user_id="a",
                user_email="a",
                user_name="a",
                user_ip_address="127.0.0.1",
                sdk_name="a",
                sdk_version="a",
                os_name="a",
                os_version="a",
                browser_name="a",
                browser_version="a",
                device_name="a",
                device_brand="a",
                device_family="a",
                device_model="a",
                segment_id=0,
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                project.id,
                replay2_id,
                platform="a",
                dist="a",
                user_id="a",
                user_email="a",
                user_name="a",
                user_ip_address="127.0.0.1",
                sdk_name="a",
                sdk_version="a",
                os_name="a",
                os_version="a",
                browser_name="a",
                browser_version="a",
                device_name="a",
                device_brand="a",
                device_family="a",
                device_model="a",
                segment_id=1,
            )
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp, project2.id, "fatal", replay1_id, uuid.uuid4().hex
            )
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp, project2.id, "error", replay1_id, uuid.uuid4().hex
            )
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp, project2.id, "warning", replay1_id, uuid.uuid4().hex
            )
        )
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project2.id, "info", replay1_id, uuid.uuid4().hex)
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp, project2.id, "debug", replay1_id, uuid.uuid4().hex
            )
        )

        with self.feature(REPLAYS_FEATURES):
            # Run all the queries individually to determine compliance.
            queries = [
                "activity",
                "browser.name",
                "browser.version",
                "device.brand",
                "device.family",
                "device.model",
                "device.name",
                "dist",
                "duration",
                "os.name",
                "os.version",
                "platform",
                "project_id",
                "sdk.name",
                "user.email",
                "user.id",
                "user.username",
                "count_warnings",
                "count_infos",
            ]

            for key in queries:
                # Ascending
                response = self.client.get(self.url + f"?sort={key}")
                assert response.status_code == 200, key

                r = response.json()
                assert len(r["data"]) == 2, key
                assert r["data"][0]["id"] == replay2_id, key
                assert r["data"][1]["id"] == replay1_id, key

                # Descending
                response = self.client.get(self.url + f"?sort=-{key}")
                assert response.status_code == 200, key

                r = response.json()
                assert len(r["data"]) == 2, key
                assert r["data"][0]["id"] == replay1_id, key
                assert r["data"][1]["id"] == replay2_id, key

    # No such thing as a bad field with the tag filtering behavior.
    #
    # def test_get_replays_filter_bad_field(self):
    #     """Test replays conform to the interchange format."""
    #     self.create_project(teams=[self.team])

    #     with self.feature(REPLAYS_FEATURES):
    #         response = self.client.get(self.url + "?query=xyz:a")
    #         assert response.status_code == 400
    #         assert b"xyz" in response.content

    def test_get_replays_filter_bad_value(self):
        """Test replays conform to the interchange format."""
        self.create_project(teams=[self.team])

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?query=duration:a")
            assert response.status_code == 400
            assert b"duration" in response.content

    def test_get_replays_no_multi_project_select(self):
        self.create_project(teams=[self.team])
        self.create_project(teams=[self.team])

        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(user)

        with self.feature(REPLAYS_FEATURES), self.feature({"organizations:global-views": False}):
            response = self.client.get(self.url)
            assert response.status_code == 400
            assert response.data["detail"] == "You cannot view events from multiple projects."

    def test_get_replays_no_multi_project_select_query_referrer(self):
        self.create_project(teams=[self.team])
        self.create_project(teams=[self.team])

        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(user)

        with self.feature(REPLAYS_FEATURES), self.feature({"organizations:global-views": False}):
            response = self.client.get(self.url + "?queryReferrer=issueReplays")
            assert response.status_code == 200

    def test_get_replays_unknown_field(self):
        """Test replays unknown fields raise a 400 error."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?field=unknown")
            assert response.status_code == 400

    def test_get_replays_activity_field(self):
        """Test replays activity field does not raise 400."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?field=activity")
            assert response.status_code == 200

    def test_archived_records_are_null_fields(self):
        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=30)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=15)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay1_id))
        self.store_replays(
            mock_replay(seq2_timestamp, self.project.id, replay1_id, is_archived=True)
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.json()["data"] == [
                {
                    "id": replay1_id,
                    "project_id": str(self.project.id),
                    "trace_ids": [],
                    "error_ids": [],
                    "environment": None,
                    "tags": [],
                    "user": {"id": "Archived Replay", "display_name": "Archived Replay"},
                    "sdk": {"name": None, "version": None},
                    "os": {"name": None, "version": None},
                    "browser": {"name": None, "version": None},
                    "device": {"name": None, "brand": None, "model": None, "family": None},
                    "urls": None,
                    "started_at": None,
                    "count_errors": None,
                    "count_dead_clicks": None,
                    "count_rage_clicks": None,
                    "activity": None,
                    "finished_at": None,
                    "duration": None,
                    "is_archived": True,
                    "releases": None,
                    "platform": None,
                    "dist": None,
                    "count_segments": None,
                    "count_urls": None,
                    "clicks": None,
                    "warning_ids": None,
                    "info_ids": None,
                    "count_warnings": None,
                    "count_infos": None,
                }
            ]

    # commented out until https://github.com/getsentry/snuba/pull/4137 is merged.
    # def test_archived_records_out_of_bounds(self):
    #     replay1_id = uuid.uuid4().hex
    #     seq1_timestamp = datetime.datetime.now() - datetime.timedelta(days=10)
    #     seq2_timestamp = datetime.datetime.now() - datetime.timedelta(days=3)

    #     self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay1_id))
    #     self.store_replays(
    #         mock_replay(
    #             seq2_timestamp, self.project.id, replay1_id, is_archived=True, segment_id=None
    #         )
    #     )

    #     with self.feature(REPLAYS_FEATURES):
    #         response = self.client.get(self.url)
    #         assert response.status_code == 200
    #         assert response.json()["data"] == [
    #             {
    #                 "id": replay1_id,
    #                 "project_id": str(self.project.id),
    #                 "trace_ids": [],
    #                 "error_ids": [],
    #                 "environment": None,
    #                 "tags": [],
    #                 "user": {"id": "Archived Replay", "display_name": "Archived Replay"},
    #                 "sdk": {"name": None, "version": None},
    #                 "os": {"name": None, "version": None},
    #                 "browser": {"name": None, "version": None},
    #                 "device": {"name": None, "brand": None, "model": None, "family": None},
    #                 "urls": None,
    #                 "started_at": None,
    #                 "count_errors": None,
    #                 "activity": None,
    #                 "finished_at": None,
    #                 "duration": None,
    #                 "is_archived": True,
    #             }
    #         ]

    def test_get_replays_filter_clicks(self):
        """Test replays conform to the interchange format."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                project.id,
                replay1_id,
                node_id=1,
                tag="div",
                id="myid",
                class_=["class1", "class2", "class:hover"],
                component_name="SignUpForm",
                role="button",
                testid="1",
                alt="Alt",
                aria_label="AriaLabel",
                title="MyTitle",
                text="Hello",
                is_dead=1,
                is_rage=1,
            )
        )
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                project.id,
                replay1_id,
                node_id=2,
                tag="button",
                id="myid",
                class_=["class1", "class3"],
            )
        )

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "click.alt:Alt",
                "click.class:class1",
                "click.class:class2",
                "click.class:class3",
                "click.id:myid",
                "click.label:AriaLabel",
                "click.component_name:SignUpForm",
                "click.role:button",
                "click.tag:div",
                "click.tag:button",
                "click.testid:1",
                "click.textContent:Hello",
                "click.title:MyTitle",
                "click.selector:div#myid",
                "click.selector:div[alt=Alt]",
                "click.selector:div[title=MyTitle]",
                "click.selector:div[data-sentry-component=SignUpForm]",
                "click.selector:div[data-testid='1']",
                "click.selector:div[data-test-id='1']",
                "click.selector:div[role=button]",
                "click.selector:div#myid.class1.class2",
                "dead.selector:div#myid",
                "rage.selector:div#myid",
                # Assert selectors with special characters in them can be queried.
                "click.selector:div.class%5C:hover",
                # Single quotes around attribute value.
                "click.selector:div[role='button']",
                "click.selector:div#myid.class1.class2[role=button][aria-label='AriaLabel']",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200, query
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

            queries = [
                "click.alt:NotAlt",
                "click.class:class4",
                "click.id:other",
                "click.label:NotAriaLabel",
                "click.component_name:NotSignUpForm",
                "click.role:form",
                "click.tag:header",
                "click.testid:2",
                "click.textContent:World",
                "click.title:NotMyTitle",
                "!click.selector:div#myid",
                "click.selector:div#notmyid",
                "dead.selector:button#myid",
                "rage.selector:button#myid",
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

    def test_get_replays_click_fields(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                project.id,
                replay1_id,
                node_id=1,
                tag="div",
                id="myid",
                class_=["class1", "class2"],
                component_name="SignUpForm",
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
                project.id,
                replay1_id,
                node_id=2,
                tag="button",
                id="myid",
                class_=["class1", "class3"],
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?field=clicks")
            assert response.status_code == 200, response.content
            response_data = response.json()
            assert response_data["data"] == [
                {
                    "clicks": [
                        {
                            "click.alt": "Alt",
                            "click.classes": ["class1", "class3"],
                            "click.id": "myid",
                            "click.component_name": "SignUpForm",
                            "click.role": "button",
                            "click.tag": "button",
                            "click.testid": "1",
                            "click.text": "Hello",
                            "click.title": "MyTitle",
                            "click.label": "AriaLabel",
                        },
                        {
                            "click.alt": None,
                            "click.classes": ["class1", "class2"],
                            "click.id": "myid",
                            "click.component_name": None,
                            "click.role": None,
                            "click.tag": "div",
                            "click.testid": None,
                            "click.text": None,
                            "click.title": None,
                            "click.label": None,
                        },
                    ]
                }
            ]

    def test_get_replays_filter_clicks_nested_selector(self):
        """Test replays do not support nested selectors."""
        project = self.create_project(teams=[self.team])
        self.store_replays(mock_replay(datetime.datetime.now(), project.id, uuid.uuid4().hex))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                'click.selector:"div button"',
                'click.selector:"div + button"',
                'click.selector:"div ~ button"',
                'click.selector:"div > button"',
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 400
                assert response.content == b'{"detail":"Nested selectors are not supported."}'

    def test_get_replays_filter_clicks_pseudo_element(self):
        """Assert replays only supports a subset of selector syntax."""
        project = self.create_project(teams=[self.team])
        self.store_replays(mock_replay(datetime.datetime.now(), project.id, uuid.uuid4().hex))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "click.selector:a::visited",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 400, query
                assert response.content == b'{"detail":"Pseudo-elements are not supported."}', query

    def test_get_replays_filter_clicks_unsupported_selector(self):
        """Assert replays only supports a subset of selector syntax."""
        project = self.create_project(teams=[self.team])
        self.store_replays(mock_replay(datetime.datetime.now(), project.id, uuid.uuid4().hex))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "click.selector:div:is(2)",
                "click.selector:p:active",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 400, query
                assert (
                    response.content
                    == b'{"detail":"Only attribute, class, id, and tag name selectors are supported."}'
                ), query

    def test_get_replays_filter_clicks_unsupported_attribute_selector(self):
        """Assert replays only supports a subset of selector syntax."""
        project = self.create_project(teams=[self.team])
        self.store_replays(mock_replay(datetime.datetime.now(), project.id, uuid.uuid4().hex))

        with self.feature(REPLAYS_FEATURES):
            queries = ["click.selector:div[xyz=test]"]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 400, query
                assert response.content == (
                    b'{"detail":"Invalid attribute specified. Only alt, aria-label, role, '
                    b'data-testid, data-test-id, data-sentry-component, and title are supported."}'
                ), query

    def test_get_replays_filter_clicks_unsupported_operators(self):
        """Assert replays only supports a subset of selector syntax."""
        project = self.create_project(teams=[self.team])
        self.store_replays(mock_replay(datetime.datetime.now(), project.id, uuid.uuid4().hex))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                'click.selector:"[aria-label~=button]"',
                'click.selector:"[aria-label|=button]"',
                'click.selector:"[aria-label^=button]"',
                'click.selector:"[aria-label$=button]"',
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 400, query
                assert (
                    response.content == b'{"detail":"Only the \'=\' operator is supported."}'
                ), query

    def test_get_replays_field_order(self):
        """Test replay response with fields requested in production."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            # Invalid field-names error regardless of ordering.
            response = self.client.get(self.url + "?field=invalid&field=browser")
            assert response.status_code == 400
            response = self.client.get(self.url + "?field=browser&field=invalid")
            assert response.status_code == 400

            # Correct field-names never error.
            response = self.client.get(self.url + "?field=count_urls&field=browser")
            assert response.status_code == 200
            response = self.client.get(self.url + "?field=browser&field=count_urls")
            assert response.status_code == 200

    def test_get_replays_memory_error(self):
        """Test replay response with fields requested in production."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            # Invalid field-names error regardless of ordering.
            with mock.patch(
                "sentry.replays.endpoints.organization_replay_index.query_replays_collection",
                side_effect=QueryMemoryLimitExceeded("mocked error"),
            ):
                response = self.client.get(self.url)
                assert response.status_code == 400
                assert (
                    response.content
                    == b'{"detail":"Query limits exceeded. Try narrowing your request."}'
                )

    @pytest.mark.skip(reason="flaky: Date logic breaks - possibly due to stats-period.")
    def test_get_replays_dead_rage_click_cutoff(self):
        """Test rage and dead clicks are accumulated after the cutoff."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        pre_cutoff = datetime.datetime(year=2023, month=7, day=23)
        post_cutoff = datetime.datetime(year=2023, month=7, day=24)

        self.store_replays(
            mock_replay(
                pre_cutoff,
                project.id,
                replay1_id,
            )
        )
        self.store_replays(
            mock_replay(
                post_cutoff,
                project.id,
                replay1_id,
            )
        )
        self.store_replays(
            mock_replay_click(
                pre_cutoff,
                project.id,
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
                is_dead=1,
                is_rage=1,
                text="Hello",
            )
        )
        self.store_replays(
            mock_replay_click(
                post_cutoff,
                project.id,
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
                is_dead=1,
                is_rage=1,
                text="Hello",
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(
                self.url
                + f"?start={pre_cutoff.isoformat().split('.')[0]}&end={post_cutoff.isoformat().split('.')[0]}"
            )
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

            item = response_data["data"][0]
            assert item["count_dead_clicks"] == 1, item["count_dead_clicks"]
            assert item["count_rage_clicks"] == 1, item["count_rage_clicks"]

    def test_get_replays_filter_clicks_non_click_rows(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                project.id,
                replay1_id,
                node_id=1,
                tag="div",
                id="id1",
                class_=["id1"],
                text="id1",
                role="id1",
                alt="id1",
                testid="id1",
                aria_label="id1",
                title="id1",
            )
        )
        self.store_replays(
            mock_replay_click(
                seq2_timestamp,
                project.id,
                replay1_id,
                node_id=2,
                tag="",
                id="id2",
                class_=["id2"],
                text="id2",
                role="id2",
                alt="id2",
                testid="id2",
                aria_label="id2",
                title="id2",
            )
        )

        with self.feature(REPLAYS_FEATURES):
            success_queries = [
                "click.id:id1",
                "click.class:[id1]",
                "click.textContent:id1",
                "click.role:id1",
                "click.alt:id1",
                "click.testid:id1",
                "click.label:id1",
                "click.title:id1",
            ]

            for query in success_queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

            # These tests demonstrate what happens when you match a click value on non-click row.
            failure_queries = [
                "click.id:id2",
                "click.class:[id2]",
                "click.textContent:id2",
                "click.role:id2",
                "click.alt:id2",
                "click.testid:id2",
                "click.label:id2",
                "click.title:id2",
            ]
            for query in failure_queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 0, query

    # The following section tests the valid branches of the condition classes.

    def test_query_branches_string_conditions(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "device.brand:Apple",
                "!device.brand:Microsoft",
                "device.brand:[Apple,Microsoft]",
                "!device.brand:[Oracle,Microsoft]",
                "device.brand:App*",
                "!device.brand:Micro*",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

    def test_query_branches_click_scalar_conditions(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))
        self.store_replays(
            mock_replay_click(
                seq2_timestamp, project.id, replay1_id, node_id=1, tag="div", id="id1"
            )
        )

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "click.id:id1",
                "!click.id:id2",
                "click.id:[id1,id2]",
                "!click.id:[id3,id2]",
                "click.id:*1",
                "!click.id:*2",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

    def test_query_branches_click_array_conditions(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))
        self.store_replays(
            mock_replay_click(
                seq2_timestamp, project.id, replay1_id, node_id=1, tag="div", class_=["class1"]
            )
        )

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "click.class:class1",
                "!click.class:class2",
                "click.class:[class1,class2]",
                "!click.class:[class3,class2]",
                "click.class:*1",
                "!click.class:*2",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

    def test_query_branches_array_of_string_conditions(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id, urls=["Apple"]))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id, urls=[]))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "urls:Apple",
                "!urls:Microsoft",
                "urls:[Apple,Microsoft]",
                "!urls:[Oracle,Microsoft]",
                "urls:App*",
                "!urls:Micro*",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

    def test_query_branches_integer_conditions(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id, error_ids=[]))
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp, project.id, "error", replay1_id, "a3a62ef6ac86415b83c2416fc2f76db1"
            )
        )

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "count_errors:1",
                "!count_errors:2",
                "count_errors:>0",
                "count_errors:<2",
                "count_errors:>=1",
                "count_errors:<=1",
                "count_errors:[1,2]",
                "!count_errors:[2,3]",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

    def test_query_branches_error_ids_conditions(self):
        project = self.create_project(teams=[self.team])

        uid1 = uuid.uuid4().hex
        uid2 = uuid.uuid4().hex

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id, error_ids=[uid1]))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                f"error_ids:{uid1}",
                f"!error_ids:{uid2}",
                f"error_ids:[{uid1},{uid2}]",
                f"!error_ids:[{uid2}]",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

    def test_query_branches_uuid_conditions(self):
        project = self.create_project(teams=[self.team])

        uid1 = uuid.uuid4().hex
        uid2 = uuid.uuid4().hex

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id, trace_ids=[uid1]))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                f"trace_ids:{uid1}",
                f"!trace_ids:{uid2}",
                f"trace_ids:[{uid1},{uid2}]",
                f"!trace_ids:[{uid2}]",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

    def test_query_branches_string_uuid_conditions(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            uid2 = uuid.uuid4().hex

            queries = [
                f"id:{replay1_id}",
                f"!id:{uid2}",
                f"id:[{replay1_id},{uid2}]",
                f"!id:[{uid2}]",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

    def test_query_branches_ip_address_conditions(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "user.ip_address:127.0.0.1",
                "!user.ip_address:192.168.0.1",
                "user.ip_address:[127.0.0.1,192.168.0.1]",
                "!user.ip_address:[192.168.0.1]",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

    def test_query_branches_computed_activity_conditions(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id, error_ids=[]))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                "activity:2",
                "!activity:1",
                "activity:>1",
                "activity:<3",
                "activity:>=2",
                "activity:<=2",
                "activity:[1,2]",
                "!activity:[1,3]",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query

    def test_query_scalar_optimization_multiple_varying(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(
            mock_replay(seq1_timestamp, project.id, replay1_id, urls=["apple", "microsoft"])
        )
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id, urls=[]))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?field=id&query=urls:apple urls:microsoft")
            assert response.status_code == 200
            response_data = response.json()
            assert len(response_data["data"]) == 1

    def test_get_replays_missing_segment_0(self):
        """Test fetching replays when the 0th segment is missing."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id, segment_id=2))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id, segment_id=1))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 0

    def test_new_errors_column(self):
        project = self.create_project(teams=[self.team])

        uid1 = uuid.uuid4().hex
        uid2 = uuid.uuid4().hex
        uid3 = uuid.uuid4().hex

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(
            mock_replay(seq1_timestamp, project.id, replay1_id, error_ids=[uid1, uid2])
        )
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id, error_ids=[]))
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "error", replay1_id, uid1)
        )
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "fatal", replay1_id, uid2)
        )
        with self.feature(REPLAYS_FEATURES):
            queries = [
                f"error_id:{uid1}",
                f"error_id:{uid2}",
                f"error_id:[{uid1}]",
                f"!error_id:[{uid3}]",
                f"!error_id:{uid3}",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&field=error_ids&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query
                assert len(response_data["data"][0]["error_ids"]) == 2, query

            response = self.client.get(
                self.url + f"?field=id&field=error_ids&query=error_id:{uid3}"
            )
            assert response.status_code == 200
            response_data = response.json()
            assert len(response_data["data"]) == 0, query

    def test_warnings_column(self):
        project = self.create_project(teams=[self.team])

        uid1 = uuid.uuid4().hex
        uid2 = uuid.uuid4().hex

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "warning", replay1_id, uid1)
        )

        with self.feature(REPLAYS_FEATURES):
            queries = [
                f"warning_id:{uid1}",
                f"warning_id:[{uid1}]",
                f"!warning_id:[{uid2}]",
                f"!warning_id:{uid2}",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&field=warning_ids&query={query}")
                assert response.status_code == 200, query
                response_data = response.json()
                assert len(response_data["data"]) == 1, query
                assert len(response_data["data"][0]["warning_ids"]) == 1, query

            response = self.client.get(
                self.url + f"?field=id&field=warning_ids&query=warning_id:{uid2}"
            )
            assert response.status_code == 200
            response_data = response.json()
            assert len(response_data["data"]) == 0, query

    def test_infos_column(self):
        project = self.create_project(teams=[self.team])

        uid1 = uuid.uuid4().hex
        uid2 = uuid.uuid4().hex
        uid3 = uuid.uuid4().hex

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "info", replay1_id, uid1)
        )
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "debug", replay1_id, uid2)
        )
        with self.feature(REPLAYS_FEATURES):
            queries = [
                f"info_id:{uid1}",
                f"info_id:{uid2}",
                f"info_id:[{uid1}]",
                f"!info_id:[{uid3}]",
                f"!info_id:{uid3}",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&field=info_ids&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query
                assert len(response_data["data"][0]["info_ids"]) == 2, query

            response = self.client.get(self.url + f"?field=id&field=info_ids&query=info_id:{uid3}")
            assert response.status_code == 200
            response_data = response.json()
            assert len(response_data["data"]) == 0, query

    def test_exp_query_branches_error_ids_conditions(self):
        """
        Test that the new columns work the same w/ only the previous errors populated
        """
        project = self.create_project(teams=[self.team])

        uid1 = uuid.uuid4().hex
        uid2 = uuid.uuid4().hex

        replay1_id = uuid.uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id, error_ids=[uid1]))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id, error_ids=[]))

        with self.feature(REPLAYS_FEATURES):
            queries = [
                f"error_ids:{uid1}",
                f"!error_ids:{uid2}",
                f"error_ids:[{uid1},{uid2}]",
                f"!error_ids:[{uid2}]",
            ]
            for query in queries:
                response = self.client.get(self.url + f"?field=id&field=error_ids&query={query}")
                assert response.status_code == 200
                response_data = response.json()
                assert len(response_data["data"]) == 1, query
                assert len(response_data["data"][0]["error_ids"]) == 1, query

    def test_event_id_count_columns(self):
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        other_replay = uuid.uuid4().hex

        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=22)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, project.id, other_replay))
        self.store_replays(mock_replay(seq2_timestamp, project.id, other_replay))

        self.store_replays(mock_replay(seq1_timestamp, project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, project.id, replay1_id))
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "fatal", replay1_id, uuid.uuid4().hex)
        )
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "error", replay1_id, uuid.uuid4().hex)
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp, project.id, "warning", replay1_id, uuid.uuid4().hex
            )
        )
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "info", replay1_id, uuid.uuid4().hex)
        )
        self.store_replays(
            self.mock_event_links(seq1_timestamp, project.id, "debug", replay1_id, uuid.uuid4().hex)
        )

        self.store_replays(
            self.mock_event_links(
                seq1_timestamp, project.id, "debug", other_replay, uuid.uuid4().hex
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(
                self.url + f"?field=id&field=count_warnings&field=count_infos&query=id:{replay1_id}"
            )
            assert response.status_code == 200
            response_data = response.json()
            assert response_data["data"][0]["count_warnings"] == 1
