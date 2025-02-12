import datetime
import uuid
from datetime import timedelta, timezone
from functools import cached_property

from django.urls import reverse

from sentry.replays.testutils import mock_replay
from sentry.search.events.constants import RELEASE_ALIAS, SEMVER_ALIAS
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class OrganizationTagKeyTestCase(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-tagkey-values"

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1)
        user = self.create_user()
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=user, teams=[self.team])
        self.login_as(user=user)

    def get_response(self, key, **kwargs):
        return super().get_response(self.org.slug, key, **kwargs)

    def run_test(self, key, expected, **kwargs):
        response = self.get_success_response(key, **kwargs)
        assert [(val["value"], val["count"]) for val in response.data] == expected

    @cached_property
    def project(self):
        return self.create_project(organization=self.org, teams=[self.team])


class OrganizationTagKeyValuesTest(OrganizationTagKeyTestCase):
    def test_simple(self):
        self.store_event(
            data={"timestamp": self.day_ago.isoformat(), "tags": {"fruit": "apple"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": self.min_ago.isoformat(), "tags": {"fruit": "orange"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": self.min_ago.isoformat(), "tags": {"some_tag": "some_value"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": self.min_ago.isoformat(), "tags": {"fruit": "orange"}},
            project_id=self.project.id,
        )

        url = reverse(
            "sentry-api-0-organization-tagkey-values",
            kwargs={"organization_id_or_slug": self.org.slug, "key": "fruit"},
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        self.run_test("fruit", expected=[("orange", 2), ("apple", 1)])

    def test_env(self):
        env2 = self.create_environment()
        self.store_event(
            data={"timestamp": self.day_ago.isoformat(), "tags": {"fruit": "apple"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": self.day_ago.isoformat(),
                "tags": {"fruit": "apple"},
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": self.day_ago.isoformat(),
                "tags": {"fruit": "apple"},
                "environment": env2.name,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": self.min_ago.isoformat(), "tags": {"fruit": "orange"}},
            project_id=self.project.id,
        )
        self.run_test(
            "fruit",
            environment=self.environment.name,
            expected=[("apple", 1)],
        )

    def test_env_with_order_by_count(self):
        # this set of tags has count 5 and but very old
        for minute in range(1, 6):
            self.store_event(
                data={
                    "timestamp": before_now(minutes=minute * 10).isoformat(),
                    "tags": {"fruit": "apple"},
                    "environment": self.environment.name,
                },
                project_id=self.project.id,
            )
        # this set of tags has count 4 and but more fresh
        for minute in range(1, 5):
            self.store_event(
                data={
                    "timestamp": self.min_ago.isoformat(),
                    "tags": {"fruit": "orange"},
                    "environment": self.environment.name,
                },
                project_id=self.project.id,
            )
        # default test ignore count just use timestamp
        self.run_test(
            "fruit",
            environment=self.environment.name,
            expected=[("orange", 4), ("apple", 5)],
        )

        # check new sorting but count
        self.run_test(
            "fruit",
            environment=self.environment.name,
            expected=[("apple", 5), ("orange", 4)],
            sort="-count",
        )

    def test_invalid_sort_field(self):
        self.store_event(
            data={"timestamp": self.day_ago.isoformat(), "tags": {"fruit": "apple"}},
            project_id=self.project.id,
        )
        response = self.get_response("fruit", sort="invalid_field")
        assert response.status_code == 400
        assert response.data == {
            "detail": "Invalid sort parameter. Please use one of: -last_seen or -count"
        }

    def test_semver_with_env(self):
        env = self.create_environment(name="dev", project=self.project)
        env1 = self.create_environment(name="prod", project=self.project)

        self.create_release(version="test@1.0.0.0", environments=[env])
        self.create_release(version="test@2.0.0.0")
        self.run_test(
            SEMVER_ALIAS,
            qs_params={"query": "1.", "environment": [env.name]},
            expected=[("1.0.0.0", None)],
        )
        self.run_test(
            SEMVER_ALIAS, qs_params={"query": "1.", "environment": [env1.name]}, expected=[]
        )

    def test_bad_key(self):
        response = self.get_response("fr uit")
        assert response.status_code == 400, response.content
        assert response.data == {"detail": 'Invalid tag key format for "fr uit"'}

    def test_snuba_column(self):
        self.store_event(
            data={"timestamp": self.day_ago.isoformat(), "user": {"email": "foo@example.com"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": self.min_ago.isoformat(), "user": {"email": "bar@example.com"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": before_now(seconds=10).isoformat(),
                "user": {"email": "baz@example.com"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": before_now(seconds=10).isoformat(),
                "user": {"email": "baz@example.com"},
            },
            project_id=self.project.id,
        )
        self.run_test(
            "user.email",
            expected=[("baz@example.com", 2), ("bar@example.com", 1), ("foo@example.com", 1)],
        )

    def test_release(self):
        self.store_event(
            data={"timestamp": self.day_ago.isoformat(), "tags": {"sentry:release": "3.1.2"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": self.min_ago.isoformat(), "tags": {"sentry:release": "4.1.2"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": self.day_ago.isoformat(), "tags": {"sentry:release": "3.1.2"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": before_now(seconds=10).isoformat(),
                "tags": {"sentry:release": "5.1.2"},
            },
            project_id=self.project.id,
        )
        self.run_test("release", expected=[("5.1.2", 1), ("4.1.2", 1), ("3.1.2", 2)])

    def test_user_tag(self):
        self.store_event(
            data={"tags": {"sentry:user": "1"}, "timestamp": self.day_ago.isoformat()},
            project_id=self.project.id,
        )
        self.store_event(
            data={"tags": {"sentry:user": "2"}, "timestamp": self.min_ago.isoformat()},
            project_id=self.project.id,
        )
        self.store_event(
            data={"tags": {"sentry:user": "1"}, "timestamp": self.day_ago.isoformat()},
            project_id=self.project.id,
        )
        self.store_event(
            data={"tags": {"sentry:user": "3"}, "timestamp": before_now(seconds=10).isoformat()},
            project_id=self.project.id,
        )
        self.run_test("user", expected=[("3", 1), ("2", 1), ("1", 2)])

    def test_project_id(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.store_event(data={"timestamp": self.day_ago.isoformat()}, project_id=self.project.id)
        self.store_event(data={"timestamp": self.min_ago.isoformat()}, project_id=self.project.id)
        self.store_event(data={"timestamp": self.day_ago.isoformat()}, project_id=other_project.id)
        self.run_test("project.id", expected=[])

    def test_project_name(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.store_event(data={"timestamp": self.day_ago.isoformat()}, project_id=self.project.id)
        self.store_event(data={"timestamp": self.min_ago.isoformat()}, project_id=self.project.id)
        self.store_event(data={"timestamp": self.day_ago.isoformat()}, project_id=other_project.id)

        # without the includeTransactions flag, this will continue to search the Events Dataset for the
        # projects tag, which doesn't exist here
        self.run_test("project", expected=[])

        # with the includeTransactions flag, this will search in the Discover Dataset where project
        # has special meaning to refer to the sentry project rather than the project tag
        self.run_test(
            "project", qs_params={"includeTransactions": "1"}, expected=[(self.project.slug, 2)]
        )

    def test_project_name_with_query(self):
        other_project = self.create_project(organization=self.org, name="test1")
        other_project2 = self.create_project(organization=self.org, name="test2")
        self.create_project(organization=self.org, name="test3")
        self.store_event(data={"timestamp": self.day_ago.isoformat()}, project_id=other_project.id)
        self.store_event(data={"timestamp": self.min_ago.isoformat()}, project_id=other_project.id)
        self.store_event(data={"timestamp": self.day_ago.isoformat()}, project_id=other_project2.id)

        # without the includeTransactions flag, this will continue to search the Events Dataset for the
        # projects tag, which doesn't exist here
        self.run_test("project", qs_params={"query": "test"}, expected=[])

        # with the includeTransactions flag, this will search in the Discover Dataset where project
        # has special meaning to refer to the sentry project rather than the project tag
        self.run_test(
            "project",
            qs_params={"includeTransactions": "1", "query": "test"},
            expected=[("test1", 2), ("test2", 1)],
        )
        self.run_test(
            "project",
            qs_params={"includeTransactions": "1", "query": "1"},
            expected=[("test1", 2)],
        )
        self.run_test(
            "project", qs_params={"includeTransactions": "1", "query": "test3"}, expected=[]
        )
        self.run_test("project", qs_params={"includeTransactions": "1", "query": "z"}, expected=[])

    def test_array_column(self):
        for i in range(3):
            self.store_event(
                data={"timestamp": self.day_ago.isoformat()}, project_id=self.project.id
            )
        self.run_test("error.type", expected=[])

    def test_no_projects(self):
        self.run_test("fruit", expected=[])

    def test_disabled_tag_keys(self):
        self.store_event(
            data={"timestamp": self.day_ago.isoformat(), "tags": {"fruit": "apple"}},
            project_id=self.project.id,
        )
        self.run_test("id", expected=[])
        self.run_test("id", qs_params={"query": "z"}, expected=[])
        self.run_test("timestamp", expected=[])
        self.run_test("timestamp", qs_params={"query": "z"}, expected=[])
        self.run_test("time", expected=[])
        self.run_test("time", qs_params={"query": "z"}, expected=[])

    def test_group_id_tag(self):
        self.store_event(
            data={
                "timestamp": (self.day_ago - timedelta(minutes=1)).isoformat(),
                "tags": {"group_id": "not-a-group-id-but-a-string"},
            },
            project_id=self.project.id,
        )
        self.run_test("group_id", expected=[("not-a-group-id-but-a-string", 1)])

    def test_user_display(self):
        self.store_event(
            data={
                "timestamp": (self.day_ago - timedelta(minutes=1)).isoformat(),
                "user": {"email": "foo@example.com", "ip_address": "127.0.0.1"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": (self.day_ago - timedelta(minutes=2)).isoformat(),
                "user": {"username": "bazz", "ip_address": "192.168.0.1"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": (self.day_ago - timedelta(minutes=3)).isoformat(),
                "user": {"ip_address": "127.0.0.1"},
            },
            project_id=self.project.id,
        )
        self.run_test(
            "user.display",
            qs_params={"includeTransactions": "1"},
            expected=[("foo@example.com", 1), ("bazz", 1), ("127.0.0.1", 1)],
        )
        self.run_test(
            "user.display",
            qs_params={"includeTransactions": "1", "query": "foo"},
            expected=[("foo@example.com", 1)],
        )
        self.run_test(
            "user.display",
            qs_params={"includeTransactions": "1", "query": "zz"},
            expected=[("bazz", 1)],
        )
        self.run_test(
            "user.display",
            qs_params={"includeTransactions": "1", "query": "1"},
            expected=[("127.0.0.1", 1)],
        )
        self.run_test(
            "user.display", qs_params={"includeTransactions": "1", "query": "bar"}, expected=[]
        )

    def test_semver(self):
        self.create_release(version="test@1.0.0.0")
        self.create_release(version="test@2.0.0.0")
        self.run_test(SEMVER_ALIAS, expected=[("2.0.0.0", None), ("1.0.0.0", None)])
        self.run_test(SEMVER_ALIAS, query="1.", expected=[("1.0.0.0", None)])
        self.run_test(SEMVER_ALIAS, query="test@1.", expected=[("test@1.0.0.0", None)])
        self.run_test(
            SEMVER_ALIAS, query="test", expected=[("test@2.0.0.0", None), ("test@1.0.0.0", None)]
        )

    def test_release_filter_for_all_releases(self):
        self.create_release(version="aaa@1.0")
        self.create_release(version="aab@1.0")
        self.create_release(version="aba@1.0")
        self.create_release(version="abc@1.0")
        self.create_release(version="bac@1.0")

        self.run_test(
            RELEASE_ALIAS,
            qs_params={"includeSessions": "1"},
            expected=[
                ("aaa@1.0", None),
                ("aab@1.0", None),
                ("aba@1.0", None),
                ("abc@1.0", None),
                ("bac@1.0", None),
            ],
        )
        self.run_test(
            RELEASE_ALIAS,
            qs_params={"includeSessions": "1", "query": "a"},
            expected=[("aaa@1.0", None), ("aab@1.0", None), ("aba@1.0", None), ("abc@1.0", None)],
        )
        self.run_test(
            RELEASE_ALIAS,
            qs_params={"includeSessions": "1", "query": "b"},
            expected=[("bac@1.0", None)],
        )
        self.run_test(
            RELEASE_ALIAS,
            qs_params={"includeSessions": "1", "query": "aa"},
            expected=[("aaa@1.0", None), ("aab@1.0", None)],
        )
        self.run_test(
            RELEASE_ALIAS,
            qs_params={"includeSessions": "1", "query": "aba"},
            expected=[("aba@1.0", None)],
        )

    def test_release_filter_for_all_releases_with_env_and_project_filters(self):
        proj2 = self.create_project()

        env1 = self.create_environment(name="dev", project=self.project)
        env2 = self.create_environment(name="prod", project=self.project)
        env3 = self.create_environment(name="test", project=proj2)

        self.create_release(version="aaa@1.0", environments=[env1, env2])
        self.create_release(version="aab@1.0", environments=[env1])
        self.create_release(version="aba@1.0", project=proj2, environments=[env3])

        self.run_test(
            RELEASE_ALIAS,
            qs_params={"includeSessions": "1", "project": [self.project.id]},
            expected=[("aaa@1.0", None), ("aab@1.0", None)],
        )
        self.run_test(
            RELEASE_ALIAS,
            qs_params={
                "includeSessions": "1",
                "project": [self.project.id],
                "environment": [env1.name],
            },
            expected=[("aaa@1.0", None), ("aab@1.0", None)],
        )
        self.run_test(
            RELEASE_ALIAS,
            qs_params={
                "includeSessions": "1",
                "project": [self.project.id],
                "environment": [env2.name],
            },
            expected=[("aaa@1.0", None)],
        )
        self.run_test(
            RELEASE_ALIAS,
            qs_params={
                "includeSessions": "1",
                "project": [self.project.id, proj2.id],
                "environment": [env2.name, env3.name],
            },
            expected=[("aaa@1.0", None), ("aba@1.0", None)],
        )

    def test_simple_flags(self):
        self.store_event(
            data={
                "contexts": {"flags": {"values": [{"flag": "abc", "result": True}]}},
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "contexts": {"flags": {"values": [{"flag": "abc", "result": False}]}},
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=self.project.id,
        )

        with self.feature({"organizations:feature-flag-autocomplete": True}):
            url = reverse(
                "sentry-api-0-organization-tagkey-values",
                kwargs={"organization_id_or_slug": self.org.slug, "key": "abc"},
            )
            response = self.client.get(url + "?useFlagsBackend=1")
            assert response.status_code == 200
            assert len(response.data) == 2

            results = sorted(response.data, key=lambda i: i["value"])
            assert results[0]["value"] == "false"
            assert results[1]["value"] == "true"
            assert results[0]["count"] == 1
            assert results[1]["count"] == 1


class TransactionTagKeyValues(OrganizationTagKeyTestCase):
    def setUp(self):
        super().setUp()
        data = load_data("transaction", timestamp=before_now(minutes=1))
        data.update(
            {
                "measurements": {"lcp": {"value": 2500}},
                "breakdowns": {"span_ops": {"ops.http": {"value": 1500}}},
            }
        )
        self.store_event(data, project_id=self.project.id)
        self.transaction = data.copy()
        self.transaction.update(
            {
                "transaction": "/city_by_code/",
                "timestamp": before_now(seconds=30).isoformat(),
                "start_timestamp": before_now(seconds=35).isoformat(),
            }
        )
        self.transaction["contexts"]["trace"].update(
            {
                "status": "unknown_error",
                "trace": "a" * 32,
                "span": "abcd1234abcd1234",
                "parent_span_id": "9000cec7cc0779c1",
                "op": "bar.server",
            }
        )
        self.store_event(
            self.transaction,
            project_id=self.project.id,
        )

    def run_test(self, key, expected, **kwargs):
        # all tests here require that we search in transactions so make that the default here
        qs_params = kwargs.get("qs_params", {})
        qs_params["includeTransactions"] = "1"
        kwargs["qs_params"] = qs_params
        super().run_test(key, expected, **kwargs)

    def test_status(self):
        self.run_test("transaction.status", expected=[("unknown", 1), ("ok", 1)])
        self.run_test(
            "transaction.status",
            qs_params={"query": "o"},
            expected=[("unknown", 1), ("ok", 1)],
        )
        self.run_test("transaction.status", qs_params={"query": "ow"}, expected=[("unknown", 1)])
        self.run_test("transaction.status", qs_params={"query": "does-not-exist"}, expected=[])

    def test_op(self):
        self.run_test("transaction.op", expected=[("bar.server", 1), ("http.server", 1)])
        self.run_test(
            "transaction.op",
            qs_params={"query": "server"},
            expected=[("bar.server", 1), ("http.server", 1)],
        )
        self.run_test("transaction.op", qs_params={"query": "bar"}, expected=[("bar.server", 1)])

    def test_duration(self):
        self.run_test("transaction.duration", expected=[("5000", 1), ("3000", 1)])
        self.run_test("transaction.duration", qs_params={"query": "5001"}, expected=[("5000", 1)])
        self.run_test("transaction.duration", qs_params={"query": "50"}, expected=[])

    def test_measurements(self):
        self.run_test("measurements.lcp", expected=[("2500.0", 2)])
        self.run_test("measurements.lcp", qs_params={"query": "2501"}, expected=[("2500.0", 2)])
        self.run_test("measurements.lcp", qs_params={"query": "25"}, expected=[])
        self.run_test("measurements.foo", expected=[])

    def test_span_ops_breakdowns(self):
        self.run_test("spans.http", expected=[("1500.0", 2)])
        self.run_test("spans.http", qs_params={"query": "1501"}, expected=[("1500.0", 2)])
        self.run_test("spans.http", qs_params={"query": "15"}, expected=[])
        self.run_test("spans.bar", expected=[])

    def test_transaction_title(self):
        self.run_test("transaction", expected=[("/city_by_code/", 1), ("/country_by_code/", 1)])
        self.run_test(
            "transaction",
            qs_params={"query": "by_code", "includeTransactions": "1"},
            expected=[("/city_by_code/", 1), ("/country_by_code/", 1)],
        )
        self.run_test("transaction", qs_params={"query": "city"}, expected=[("/city_by_code/", 1)])

    def test_invalid_keys(self):
        self.run_test("trace.parent_span", expected=[])
        self.run_test("trace.span", expected=[])
        self.run_test("trace", expected=[])
        self.run_test("event_id", expected=[])
        self.run_test("profile_id", expected=[])
        self.run_test("replay_id", expected=[])

    def test_boolean_fields(self):
        self.run_test("error.handled", expected=[("true", None), ("false", None)])
        self.run_test("error.unhandled", expected=[("true", None), ("false", None)])
        self.run_test("error.main_thread", expected=[("true", None), ("false", None)])
        self.run_test("stack.in_app", expected=[("true", None), ("false", None)])


class ReplayOrganizationTagKeyValuesTest(OrganizationTagKeyTestCase, ReplaysSnubaTestCase):
    def setUp(self):
        super().setUp()
        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay3_id = uuid.uuid4().hex
        date_now = datetime.datetime.now(tz=timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        self.r1_seq1_timestamp = date_now - datetime.timedelta(seconds=22)
        self.r1_seq2_timestamp = date_now - datetime.timedelta(seconds=15)
        self.r2_seq1_timestamp = date_now - datetime.timedelta(seconds=10)
        self.r3_seq1_timestamp = date_now - datetime.timedelta(seconds=10)
        self.r4_seq1_timestamp = date_now - datetime.timedelta(seconds=5)
        self.store_replays(
            mock_replay(
                self.r1_seq1_timestamp,
                self.project.id,
                replay1_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/test123",
                    "http://localhost:3000/test123",
                ],
                tags={"fruit": "orange"},
                segment_id=0,
            ),
        )
        self.store_replays(
            mock_replay(
                self.r1_seq2_timestamp,
                self.project.id,
                replay1_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                    "http://localhost:3000/test456",
                ],
                tags={"fruit": "orange"},
                segment_id=1,
            ),
        )
        self.store_replays(
            mock_replay(
                self.r2_seq1_timestamp,
                self.project.id,
                replay2_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/otherpage",
                ],
                tags={"fruit": "orange"},
            )
        )
        self.store_replays(
            mock_replay(
                self.r3_seq1_timestamp,
                self.project.id,
                replay3_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],
                tags={"fruit": "apple", "drink": "water"},
            )
        )
        self.store_replays(
            mock_replay(
                self.r4_seq1_timestamp,
                self.project.id,
                uuid.uuid4().hex,
                platform="python",
                replay_type="error",
                environment="development",
                dist="def456",
                release="1.0.0",
                user_id="456",
                user_name="test",
                user_email="test@bacon.com",
                ipv4="10.0.0.1",
                browser_name="Firefox",
                browser_version="99.0.0",
                sdk_name="sentry.javascript.browser",
                sdk_version="5.15.5",
                os_name="SuseLinux",
                os_version="1.0.0",
                device_name="Microwave",
                device_brand="Samsung",
                device_model="123",
                device_family="Sears",
            )
        )

    def get_replays_response(self, key, kwargs):
        qs_params = kwargs.get("qs_params", {})
        qs_params["includeReplays"] = "1"
        kwargs["qs_params"] = qs_params
        response = self.get_success_response(key, **kwargs)
        return sorted(response.data, key=lambda x: x["value"])

    def run_test(self, key, expected, **kwargs):
        # all tests here require that we search in replays so make that the default here

        res = self.get_replays_response(key, kwargs)

        assert [(val["value"], val["count"]) for val in res] == expected

    def run_test_and_check_seen(self, key, expected, **kwargs):
        res = self.get_replays_response(key, kwargs)
        assert [
            (val["value"], val["count"], val["firstSeen"], val["lastSeen"]) for val in res
        ] == expected

    def test_replays_tags_values(self):
        # 3 orange values were mocked, but we only return 2 because two of them
        # were in the same replay
        self.run_test("fruit", expected=[("apple", 1), ("orange", 2)])
        self.run_test("replay_type", expected=[("error", 1), ("session", 3)])
        self.run_test("environment", expected=[("development", 1), ("production", 3)])
        self.run_test("dist", expected=[("abc123", 3), ("def456", 1)])

        self.run_test("platform", expected=[("javascript", 3), ("python", 1)])
        self.run_test("release", expected=[("1.0.0", 1), ("version@1.3", 3)])
        self.run_test("user.id", expected=[("123", 3), ("456", 1)])
        self.run_test("user.username", expected=[("test", 1), ("username", 3)])
        self.run_test("user.email", expected=[("test@bacon.com", 1), ("username@example.com", 3)])
        self.run_test("user.ip", expected=[("10.0.0.1", 1), ("127.0.0.1", 3)])
        self.run_test(
            "sdk.name", expected=[("sentry.javascript.browser", 1), ("sentry.javascript.react", 3)]
        )
        self.run_test("sdk.version", expected=[("5.15.5", 1), ("6.18.1", 3)])
        self.run_test("os.name", expected=[("SuseLinux", 1), ("iOS", 3)])
        self.run_test("os.version", expected=[("1.0.0", 1), ("16.2", 3)])
        self.run_test(
            "browser.name",
            expected=[("Chrome", 3), ("Firefox", 1)],
        )
        self.run_test("browser.version", expected=[("103.0.38", 3), ("99.0.0", 1)])
        self.run_test("device.name", expected=[("Microwave", 1), ("iPhone 13 Pro", 3)])
        self.run_test("device.brand", expected=[("Apple", 3), ("Samsung", 1)])
        self.run_test("device.family", expected=[("Sears", 1), ("iPhone", 3)])

        # check firstSeen/lastSeen for some of the tags
        self.run_test_and_check_seen(
            "device.model_id",
            expected=[
                ("123", 1, self.r4_seq1_timestamp, self.r4_seq1_timestamp),
                ("13 Pro", 3, self.r1_seq1_timestamp, self.r3_seq1_timestamp),
            ],
        )

        self.run_test_and_check_seen(
            "url",
            expected=[
                ("http://localhost:3000/", 3, self.r1_seq1_timestamp, self.r3_seq1_timestamp),
                ("http://localhost:3000/login", 2, self.r1_seq2_timestamp, self.r3_seq1_timestamp),
                (
                    "http://localhost:3000/otherpage",
                    1,
                    self.r2_seq1_timestamp,
                    self.r2_seq1_timestamp,
                ),
                (
                    "http://localhost:3000/test123",
                    1,
                    self.r1_seq1_timestamp,
                    self.r1_seq1_timestamp,
                ),
                (
                    "http://localhost:3000/test456",
                    1,
                    self.r1_seq2_timestamp,
                    self.r1_seq2_timestamp,
                ),
            ],
        )

    def test_replays_tags_values_query(self):
        # requests may pass in a "query" param to filter the return values with a substring

        # custom tag
        self.run_test("fruit", expected=[("orange", 2)], qs_params={"query": "ora"})
        self.run_test("fruit", expected=[("apple", 1), ("orange", 2)], qs_params={"query": "e"})
        self.run_test("fruit", expected=[], qs_params={"query": "zz"})

        # column aliases
        self.run_test("replay_type", expected=[("error", 1)], qs_params={"query": "err"})
        self.run_test(
            "environment",
            expected=[("development", 1), ("production", 3)],
            qs_params={"query": "d"},
        )
        self.run_test("dist", expected=[], qs_params={"query": "z"})

        self.run_test("platform", expected=[("python", 1)], qs_params={"query": "o"})
        self.run_test(
            "release", expected=[("1.0.0", 1), ("version@1.3", 3)], qs_params={"query": "1."}
        )
        self.run_test("user.id", expected=[("123", 3)], qs_params={"query": "1"})
        self.run_test("user.username", expected=[("username", 3)], qs_params={"query": "a"})
        self.run_test(
            "user.email",
            expected=[("test@bacon.com", 1), ("username@example.com", 3)],
            qs_params={"query": "@"},
        )
        self.run_test("user.ip", expected=[], qs_params={"query": "!^"})
        self.run_test("sdk.name", expected=[], qs_params={"query": "sentry-javascript"})
        self.run_test(
            "sdk.version", expected=[("5.15.5", 1), ("6.18.1", 3)], qs_params={"query": ".1"}
        )
        self.run_test("os.name", expected=[("SuseLinux", 1)], qs_params={"query": "Linux"})
        self.run_test("os.version", expected=[("1.0.0", 1)], qs_params={"query": "0.0"})
        self.run_test("browser.name", expected=[("Chrome", 3)], qs_params={"query": "Chrome"})
        self.run_test("browser.version", expected=[("99.0.0", 1)], qs_params={"query": "99"})
        self.run_test(
            "device.name",
            expected=[("Microwave", 1), ("iPhone 13 Pro", 3)],
            qs_params={"query": "i"},
        )
        self.run_test("device.brand", expected=[("Samsung", 1)], qs_params={"query": "S"})
        self.run_test("device.family", expected=[], qs_params={"query": "$$$"})

    def test_replays_tags_values_query_case_insensitive(self):
        # custom tag
        self.run_test("fruit", expected=[("orange", 2)], qs_params={"query": "OrA"})

        # some column aliases
        self.run_test("browser.name", expected=[("Chrome", 3)], qs_params={"query": "chrom"})
        self.run_test(
            "environment",
            expected=[("development", 1), ("production", 3)],
            qs_params={"query": "D"},
        )

    def test_schema(self):

        res = self.get_replays_response("fruit", {})

        assert sorted(res[0].keys()) == [
            "count",
            "firstSeen",
            "key",
            "lastSeen",
            "name",
            "value",
        ]


class DatasetParamOrganizationTagKeyValuesTest(OrganizationTagKeyTestCase, OccurrenceTestMixin):
    def setUp(self):
        super().setUp()

    def run_dataset_test(self, key, expected, dataset: Dataset, **kwargs):
        # all tests here require that we search in transactions so make that the default here
        qs_params = kwargs.get("qs_params", {})
        qs_params["dataset"] = dataset.value
        kwargs["qs_params"] = qs_params
        super().run_test(key, expected, **kwargs)

    def test_dataset_events(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"berry": "raspberry"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "tags": {"berry": "blueberry"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "tags": {"berry": "banana"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "tags": {"berry": "banana"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        # Should appear in Events and Discover datasets, but not IssuePlatform
        self.run_dataset_test(
            "berry",
            expected=[("raspberry", 1), ("blueberry", 1), ("banana", 2)],
            dataset=Dataset.Events,
        )
        self.run_dataset_test(
            "berry",
            expected=[("raspberry", 1), ("blueberry", 1), ("banana", 2)],
            dataset=Dataset.Discover,
        )
        self.run_dataset_test(
            "berry",
            expected=[],
            dataset=Dataset.IssuePlatform,
        )

    def test_dataset_issue_platform(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"stone_fruit": "peach"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.process_occurrence(
            event_id=uuid.uuid4().hex,
            project_id=self.project.id,
            event_data={
                "title": "some problem",
                "platform": "python",
                "tags": {"stone_fruit": "cherry"},
                "timestamp": self.min_ago.isoformat(),
                "received": self.min_ago.isoformat(),
            },
        )

        # (stone_fruit: cherry) should appear in IssuePlatform dataset,
        # but (sonte_fruit: peach) should not
        self.run_dataset_test(
            "stone_fruit",
            expected=[("cherry", 1)],
            dataset=Dataset.IssuePlatform,
        )
        self.run_dataset_test(
            "stone_fruit",
            expected=[("peach", 1)],
            dataset=Dataset.Events,
        )
        self.run_dataset_test(
            "stone_fruit",
            expected=[("peach", 1)],
            dataset=Dataset.Discover,
        )

    def test_dataset_discover(self):
        event = load_data("transaction")
        event["tags"].extend([["fake_fruit", "tomato"]])
        event.update(
            {
                "transaction": "example_transaction",
                "event_id": uuid.uuid4().hex,
                "start_timestamp": self.min_ago.isoformat(),
                "timestamp": self.min_ago.isoformat(),
            }
        )
        event["measurements"]["lcp"]["value"] = 5000
        self.store_event(data=event, project_id=self.project.id)

        self.run_dataset_test(
            "fake_fruit",
            expected=[],
            dataset=Dataset.IssuePlatform,
        )
        self.run_dataset_test(
            "fake_fruit",
            expected=[],
            dataset=Dataset.Events,
        )
        self.run_dataset_test(
            "fake_fruit",
            expected=[("tomato", 1)],
            dataset=Dataset.Discover,
        )
