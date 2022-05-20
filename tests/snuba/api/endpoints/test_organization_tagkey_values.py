from datetime import timedelta

from django.urls import reverse
from exam import fixture

from sentry.search.events.constants import RELEASE_ALIAS, SEMVER_ALIAS
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data


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

    @fixture
    def project(self):
        return self.create_project(organization=self.org, teams=[self.team])

    @fixture
    def group(self):
        return self.create_group(project=self.project)


class OrganizationTagKeyValuesTest(OrganizationTagKeyTestCase):
    def test_simple(self):
        self.store_event(
            data={"timestamp": iso_format(self.day_ago), "tags": {"fruit": "apple"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "tags": {"fruit": "orange"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "tags": {"some_tag": "some_value"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "tags": {"fruit": "orange"}},
            project_id=self.project.id,
        )

        url = reverse(
            "sentry-api-0-organization-tagkey-values",
            kwargs={"organization_slug": self.org.slug, "key": "fruit"},
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        self.run_test("fruit", expected=[("orange", 2), ("apple", 1)])

    def test_env(self):
        env2 = self.create_environment()
        self.store_event(
            data={"timestamp": iso_format(self.day_ago), "tags": {"fruit": "apple"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago),
                "tags": {"fruit": "apple"},
                "environment": self.environment.name,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago),
                "tags": {"fruit": "apple"},
                "environment": env2.name,
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "tags": {"fruit": "orange"}},
            project_id=self.project.id,
        )
        self.run_test(
            "fruit",
            environment=self.environment.name,
            expected=[("apple", 1)],
        )

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
            data={"timestamp": iso_format(self.day_ago), "user": {"email": "foo@example.com"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "user": {"email": "bar@example.com"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=10)),
                "user": {"email": "baz@example.com"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=10)),
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
            data={"timestamp": iso_format(self.day_ago), "tags": {"sentry:release": "3.1.2"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "tags": {"sentry:release": "4.1.2"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.day_ago), "tags": {"sentry:release": "3.1.2"}},
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(before_now(seconds=10)),
                "tags": {"sentry:release": "5.1.2"},
            },
            project_id=self.project.id,
        )
        self.run_test("release", expected=[("5.1.2", 1), ("4.1.2", 1), ("3.1.2", 2)])

    def test_user_tag(self):
        self.store_event(
            data={"tags": {"sentry:user": "1"}, "timestamp": iso_format(self.day_ago)},
            project_id=self.project.id,
        )
        self.store_event(
            data={"tags": {"sentry:user": "2"}, "timestamp": iso_format(self.min_ago)},
            project_id=self.project.id,
        )
        self.store_event(
            data={"tags": {"sentry:user": "1"}, "timestamp": iso_format(self.day_ago)},
            project_id=self.project.id,
        )
        self.store_event(
            data={"tags": {"sentry:user": "3"}, "timestamp": iso_format(before_now(seconds=10))},
            project_id=self.project.id,
        )
        self.run_test("user", expected=[("3", 1), ("2", 1), ("1", 2)])

    def test_project_id(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.store_event(data={"timestamp": iso_format(self.day_ago)}, project_id=self.project.id)
        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=self.project.id)
        self.store_event(data={"timestamp": iso_format(self.day_ago)}, project_id=other_project.id)
        self.run_test("project.id", expected=[])

    def test_project_name(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        self.store_event(data={"timestamp": iso_format(self.day_ago)}, project_id=self.project.id)
        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=self.project.id)
        self.store_event(data={"timestamp": iso_format(self.day_ago)}, project_id=other_project.id)

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
        self.store_event(data={"timestamp": iso_format(self.day_ago)}, project_id=other_project.id)
        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=other_project.id)
        self.store_event(data={"timestamp": iso_format(self.day_ago)}, project_id=other_project2.id)

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
                data={"timestamp": iso_format(self.day_ago)}, project_id=self.project.id
            )
        self.run_test("error.type", expected=[])

    def test_no_projects(self):
        self.run_test("fruit", expected=[])

    def test_disabled_tag_keys(self):
        self.store_event(
            data={"timestamp": iso_format(self.day_ago), "tags": {"fruit": "apple"}},
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
                "timestamp": iso_format(self.day_ago - timedelta(minutes=1)),
                "tags": {"group_id": "not-a-group-id-but-a-string"},
            },
            project_id=self.project.id,
        )
        self.run_test("group_id", expected=[("not-a-group-id-but-a-string", 1)])

    def test_user_display(self):
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago - timedelta(minutes=1)),
                "user": {"email": "foo@example.com", "ip_address": "127.0.0.1"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago - timedelta(minutes=2)),
                "user": {"username": "bazz", "ip_address": "192.168.0.1"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago - timedelta(minutes=3)),
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
                "timestamp": iso_format(before_now(seconds=30)),
                "start_timestamp": iso_format(before_now(seconds=35)),
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

    def test_boolean_fields(self):
        self.run_test("error.handled", expected=[("true", None), ("false", None)])
        self.run_test("error.unhandled", expected=[("true", None), ("false", None)])
