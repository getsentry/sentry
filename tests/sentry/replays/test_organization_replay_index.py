import datetime
import uuid

from django.urls import reverse

from sentry.replays.testutils import assert_expected_response, mock_expected_response, mock_replay
from sentry.testutils import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.silo import region_silo_test
from sentry.utils.cursors import Cursor

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
            )
            assert_expected_response(response_data["data"][0], expected_response)

    def test_get_replays_require_duration(self):
        """Test returned replays must have a substantive duration."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=15)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp0 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        replay2_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=6)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 1

    def test_get_replays_require_timely_initial_sequence(self):
        """Test returned replays can not partially fall outside of range."""
        project = self.create_project(teams=[self.team])

        replay1_id = uuid.uuid4().hex
        replay1_timestamp0 = datetime.datetime.now() - datetime.timedelta(days=365)
        replay1_timestamp1 = datetime.datetime.now() - datetime.timedelta(seconds=10)

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert len(response_data["data"]) == 0

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
            response = self.client.get(self.url + "?sort=-startedAt")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay2_id
            assert response_data["data"][1]["id"] == replay1_id

            # Earlist first.
            response = self.client.get(self.url + "?sort=startedAt")
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
            response = self.client.get(self.url + "?sort=-finishedAt")
            response_data = response.json()
            assert response_data["data"][0]["id"] == replay2_id
            assert response_data["data"][1]["id"] == replay1_id

            # Earlist first.
            response = self.client.get(self.url + "?sort=finishedAt")
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

        self.store_replays(mock_replay(replay1_timestamp0, project.id, replay1_id))
        self.store_replays(mock_replay(replay1_timestamp1, project.id, replay1_id))
        self.store_replays(mock_replay(replay2_timestamp0, project.id, replay2_id))
        self.store_replays(mock_replay(replay2_timestamp1, project.id, replay2_id))

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
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                project.id,
                replay1_id,
                os_name=None,
                os_version=None,
                browser_name=None,
                browser_version=None,
                device_name=None,
                device_brand=None,
                device_family=None,
                device_model=None,
                tags={"a": "n", "b": "o"},
            )
        )

        with self.feature(REPLAYS_FEATURES):
            # Run all the queries individually to determine compliance.
            queries = [
                "platform:javascript",
                "releases:version@1.3",
                "releases:[a,version@1.3]",
                "duration:>15",
                "user.id:123",
                "user.name:username123",
                "user.email:username@example.com",
                "user.email:*@example.com",
                "user.ipAddress:127.0.0.1",
                "sdk.name:sentry.javascript.react",
                "os.name:macOS",
                "os.version:15",
                "browser.name:Firefox",
                "browser.version:99",
                "dist:abc123",
                "releases:*3",
                "!releases:*4",
                "countSegments:>=2",
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
                "a:m",
                "a:[n,o]",
                "c:*st",
                "!c:*zz",
                "urls:example.com",
            ]

            for query in queries:
                response = self.client.get(self.url + f"?query={query}")
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
                f"id:{replay1_id} AND id:b",
                f"id:{replay1_id} AND duration:>1000",
                "id:b OR duration:>1000",
                "a:o",
                "a:[o,p]",
                "releases:a",
                "releases:*4",
                "!releases:*3",
                "releases:[a,b]",
                "c:*zz",
                "!c:*st",
            ]
            for query in null_queries:
                response = self.client.get(self.url + f"?query={query}")
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
            )
        )

        with self.feature(REPLAYS_FEATURES):
            # Run all the queries individually to determine compliance.
            queries = [
                "projectId",
                "platform",
                "dist",
                "duration",
                "sdk.name",
                "os.name",
                "os.version",
                "browser.name",
                "browser.version",
                "device.name",
                "device.brand",
                "device.family",
                "device.model",
                "user.id",
                "user.name",
                "user.email",
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

    def test_archived_records_are_not_returned(self):
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
            assert len(response.json()["data"]) == 0
