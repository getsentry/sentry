from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from django.http import HttpResponse
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail
from snuba_sdk import And, Column, Condition, Function, Op, Or

from sentry.profiles.flamegraph import FlamegraphExecutor
from sentry.profiles.utils import proxy_profiling_service
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase, ProfilesSnubaTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.utils.samples import load_data
from sentry.utils.snuba import bulk_snuba_queries, raw_snql_query


class OrganizationProfilingFlamegraphTestLegacy(APITestCase):
    endpoint = "sentry-api-0-organization-profiling-flamegraph"
    features = {"organizations:profiling": True}

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def do_request(self, query, features=None, compat=True, **kwargs):
        if features is None:
            features = self.features
        with self.feature(features):
            return self.client.get(
                self.url,
                query,
                format="json",
                **kwargs,
            )

    def test_more_than_one_project(self):
        projects = [
            self.create_project(),
            self.create_project(),
        ]
        # Need this feature so we don't get the multiple project without global view error
        with self.feature("organizations:global-views"):
            response = self.do_request(
                {
                    "projects": [p.id for p in projects],
                }
            )
        assert response.status_code == 400, response.data
        assert response.data == {
            "detail": ErrorDetail(
                "You cannot get a flamegraph from multiple projects.",
                code="parse_error",
            ),
        }

    @patch("sentry.search.events.builder.base.raw_snql_query", wraps=raw_snql_query)
    @patch("sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service")
    def test_queries_functions(self, mock_proxy_profiling_service, mock_raw_snql_query):
        mock_proxy_profiling_service.return_value = HttpResponse(status=200)

        fingerprint = int(uuid4().hex[:8], 16)

        response = self.do_request(
            {
                "project": [self.project.id],
                "query": "transaction:foo",
                "fingerprint": str(fingerprint),
            },
        )
        assert response.status_code == 200, response.content

        mock_raw_snql_query.assert_called_once()

        call_args = mock_raw_snql_query.call_args.args
        snql_request = call_args[0]

        assert snql_request.dataset == Dataset.Functions.value
        assert (
            Condition(
                Function("toUInt32", [Column("fingerprint")], "fingerprint"),
                Op.EQ,
                fingerprint,
            )
            in snql_request.query.where
        )
        assert Condition(Column("transaction_name"), Op.EQ, "foo") in snql_request.query.where

    @patch("sentry.search.events.builder.base.raw_snql_query", wraps=raw_snql_query)
    @patch("sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service")
    def test_queries_transactions(self, mock_proxy_profiling_service, mock_raw_snql_query):
        mock_proxy_profiling_service.return_value = HttpResponse(status=200)

        response = self.do_request(
            {
                "project": [self.project.id],
                "query": "transaction:foo",
            },
        )
        assert response.status_code == 200, response.content

        mock_raw_snql_query.assert_called_once()

        call_args = mock_raw_snql_query.call_args.args
        snql_request = call_args[0]

        assert snql_request.dataset == Dataset.Discover.value
        assert Condition(Column("profile_id"), Op.IS_NOT_NULL) in snql_request.query.where
        assert Condition(Column("transaction"), Op.EQ, "foo") in snql_request.query.where


class OrganizationProfilingFlamegraphTest(ProfilesSnubaTestCase):
    endpoint = "sentry-api-0-organization-profiling-flamegraph"
    features = {
        "organizations:profiling": True,
        "organizations:continuous-profiling-compat": True,
    }

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))
        self.ten_mins_ago = before_now(minutes=10)
        self.hour_ago = before_now(hours=1).replace(minute=0, second=0, microsecond=0)

    def do_request(self, query, features=None, compat=True, **kwargs):
        if features is None:
            features = self.features
        with self.feature(features):
            if compat:
                query["compat"] = "1"
            return self.client.get(
                self.url,
                query,
                format="json",
                **kwargs,
            )

    def store_transaction(
        self,
        transaction=None,
        profile_id=None,
        profiler_id=None,
        thread_id=None,
        transaction_id=None,
        project=None,
    ):
        data = load_data("transaction", timestamp=self.ten_mins_ago)

        if transaction is not None:
            data["transaction"] = transaction

        if profile_id is not None:
            data.setdefault("contexts", {}).setdefault("profile", {})["profile_id"] = profile_id

        if profiler_id is not None:
            data.setdefault("contexts", {}).setdefault("profile", {})["profiler_id"] = profiler_id

        if thread_id is not None:
            data.setdefault("contexts", {}).setdefault("trace", {}).setdefault("data", {})[
                "thread.id"
            ] = thread_id

        if transaction_id is not None:
            data["event_id"] = transaction_id

        self.store_event(data, project_id=project.id if project else self.project.id)

        return data

    def test_no_feature(self):
        response = self.do_request({}, features=[])
        assert response.status_code == 404, response.data

    def test_no_project(self):
        response = self.do_request({})
        assert response.status_code == 404, response.data

    def test_invalid_params(self):
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataSource": "foo",
                "fingerprint": str(1 << 32),
            },
        )
        assert response.status_code == 400, response.content
        assert response.data == {
            "dataSource": [ErrorDetail('"foo" is not a valid choice.', code="invalid_choice")],
            "fingerprint": [
                ErrorDetail(
                    string="Ensure this value is less than or equal to 4294967295.",
                    code="max_value",
                )
            ],
        }

    def test_discover_dataset_with_fingerprint_invalid(self):
        response = self.do_request(
            {
                "project": [self.project.id],
                "dataSource": "transactions",
                "fingerprint": "1",
            },
        )
        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": ErrorDetail(
                '"fingerprint" is only permitted when using dataSource: "functions"',
                code="parse_error",
            ),
        }

    def test_invalid_expand(self):
        response = self.do_request(
            {
                "project": [self.project.id],
                "expand": "foo",
            },
        )
        assert response.status_code == 400, response.content
        assert response.data == {
            "expand": [ErrorDetail('"foo" is not a valid choice.', code="invalid_choice")],
        }

    def test_expands_metrics(self):
        with (
            patch(
                "sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service"
            ) as mock_proxy_profiling_service,
            patch.object(
                FlamegraphExecutor,
                "get_profile_candidates",
            ) as mock_get_profile_candidates,
        ):
            mock_get_profile_candidates.return_value = {
                "continuous": [],
                "transactions": [],
            }
            mock_proxy_profiling_service.return_value = HttpResponse(status=200)
            response = self.do_request(
                {
                    "project": [self.project.id],
                    "expand": "metrics",
                },
            )

            assert response.status_code == 200, response.content

        mock_proxy_profiling_service.assert_called_once_with(
            method="POST",
            path=f"/organizations/{self.project.organization.id}/flamegraph",
            json_data={
                "transactions": [],
                "continuous": [],
                "generate_metrics": True,
            },
        )

    def test_queries_profile_candidates_from_functions(self):
        fingerprint = int(uuid4().hex[:8], 16)

        for query in [
            {
                "project": [self.project.id],
                "dataSource": "functions",
                "query": "transaction:foo",
                "fingerprint": str(fingerprint),
            },
            {
                "project": [self.project.id],
                "query": "transaction:foo",
                "fingerprint": str(fingerprint),
            },
        ]:
            with (
                patch(
                    "sentry.search.events.builder.base.raw_snql_query", wraps=raw_snql_query
                ) as mock_raw_snql_query,
                patch(
                    "sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service"
                ) as mock_proxy_profiling_service,
            ):
                mock_proxy_profiling_service.return_value = HttpResponse(status=200)

                response = self.do_request(query)
                assert response.status_code == 200, response.content

                mock_raw_snql_query.assert_called_once()

                call_args = mock_raw_snql_query.call_args.args
                snql_request = call_args[0]

                assert snql_request.dataset == Dataset.Functions.value
                assert (
                    Condition(
                        Function("toUInt32", [Column("fingerprint")], "fingerprint"),
                        Op.EQ,
                        fingerprint,
                    )
                    in snql_request.query.where
                )
                assert (
                    Condition(Column("transaction_name"), Op.EQ, "foo") in snql_request.query.where
                )

    def test_queries_profile_candidates_from_transactions(self):
        for query in [
            {
                "project": [self.project.id],
                "dataSource": "transactions",
                "query": "transaction:foo",
            },
            {
                "project": [self.project.id],
                "query": "transaction:foo",
            },
        ]:
            with (
                patch(
                    "sentry.search.events.builder.base.raw_snql_query", wraps=raw_snql_query
                ) as mock_raw_snql_query,
                patch(
                    "sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service"
                ) as mock_proxy_profiling_service,
            ):
                mock_proxy_profiling_service.return_value = HttpResponse(status=200)

                response = self.do_request(query)

                assert response.status_code == 200, response.content

                mock_raw_snql_query.assert_called_once()

                call_args = mock_raw_snql_query.call_args.args
                snql_request = call_args[0]

                assert snql_request.dataset == Dataset.Discover.value
                assert (
                    Or(
                        conditions=[
                            Condition(Column("profile_id"), Op.IS_NOT_NULL),
                            And(
                                conditions=[
                                    Condition(Column("profiler_id"), Op.IS_NOT_NULL),
                                    Condition(
                                        Function(
                                            "has", [Column("contexts.key"), "trace.thread_id"]
                                        ),
                                        Op.EQ,
                                        1,
                                    ),
                                ],
                            ),
                        ],
                    )
                    in snql_request.query.where
                )
                assert Condition(Column("transaction"), Op.EQ, "foo") in snql_request.query.where

    def test_queries_profile_candidates_from_profiles(self):
        with (
            patch(
                "sentry.profiles.flamegraph.bulk_snuba_queries", wraps=bulk_snuba_queries
            ) as mock_bulk_snuba_queries,
            patch(
                "sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service"
            ) as mock_proxy_profiling_service,
        ):
            mock_proxy_profiling_service.return_value = HttpResponse(status=200)

            response = self.do_request(
                {
                    "project": [self.project.id],
                    "dataSource": "profiles",
                },
            )

            assert response.status_code == 200, response.content

            mock_bulk_snuba_queries.assert_called_once()

            call_args = mock_bulk_snuba_queries.call_args.args
            [transactions_snql_request, profiles_snql_request] = call_args[0]

            assert transactions_snql_request.dataset == Dataset.Discover.value
            assert (
                Or(
                    conditions=[
                        Condition(Column("profile_id"), Op.IS_NOT_NULL),
                        And(
                            conditions=[
                                Condition(Column("profiler_id"), Op.IS_NOT_NULL),
                                Condition(
                                    Function("has", [Column("contexts.key"), "trace.thread_id"]),
                                    Op.EQ,
                                    1,
                                ),
                            ],
                        ),
                    ],
                )
                in transactions_snql_request.query.where
            )

            assert profiles_snql_request.dataset == Dataset.Profiles.value

    @patch("sentry.profiles.flamegraph.bulk_snuba_queries", wraps=bulk_snuba_queries)
    @patch("sentry.search.events.builder.base.raw_snql_query", wraps=raw_snql_query)
    @patch("sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service")
    def test_queries_profile_candidates_from_functions_with_data(
        self,
        mock_proxy_profiling_service,
        mock_raw_snql_query,
        mock_bulk_snuba_queries,
    ):
        data = load_data("transaction", timestamp=self.hour_ago)
        data["transaction"] = "foo"
        profile_id = uuid4().hex
        data.setdefault("contexts", {}).setdefault("profile", {})["profile_id"] = profile_id

        stored_1 = self.store_functions(
            [
                {
                    "self_times_ns": [100_000_000],
                    "package": "foo",
                    "function": "bar",
                    "in_app": True,
                },
            ],
            project=self.project,
            transaction=data,
            timestamp=self.hour_ago,
        )
        stored_2 = self.store_functions_chunk(
            [
                {
                    "self_times_ns": [100_000_000],
                    "package": "foo",
                    "function": "bar",
                    "thread_id": "1",
                    "in_app": True,
                },
            ],
            project=self.project,
            timestamp=self.hour_ago,
        )

        chunk = {
            "project_id": self.project.id,
            "profiler_id": stored_2["profiler_id"],
            "chunk_id": stored_2["chunk_id"],
            "start_timestamp": self.hour_ago.isoformat(),
            "end_timestamp": (self.hour_ago + timedelta(microseconds=100_000)).isoformat(),
        }

        mock_bulk_snuba_queries.return_value = [{"data": [chunk]}]

        mock_proxy_profiling_service.return_value = HttpResponse(status=200)

        fingerprint = stored_1["functions"][0]["fingerprint"]

        response = self.do_request(
            {
                "project": [self.project.id],
                "dataSource": "functions",
                "fingerprint": str(fingerprint),
            },
        )
        assert response.status_code == 200, response.content

        mock_raw_snql_query.assert_called_once()

        call_args = mock_raw_snql_query.call_args.args
        snql_request = call_args[0]

        assert snql_request.dataset == Dataset.Functions.value
        assert (
            Condition(
                Function("toUInt32", [Column("fingerprint")], "fingerprint"),
                Op.EQ,
                fingerprint,
            )
            in snql_request.query.where
        )

        mock_proxy_profiling_service.assert_called_once_with(
            method="POST",
            path=f"/organizations/{self.project.organization.id}/flamegraph",
            json_data={
                "transaction": [
                    {
                        "project_id": self.project.id,
                        "profile_id": profile_id,
                    },
                ],
                "continuous": [
                    {
                        "project_id": self.project.id,
                        "profiler_id": stored_2["profiler_id"],
                        "chunk_id": stored_2["chunk_id"],
                        "thread_id": "1",
                        "start": str(int(self.hour_ago.timestamp() * 1e9)),
                        "end": str(
                            int((self.hour_ago + timedelta(microseconds=100_000)).timestamp() * 1e9)
                        ),
                    },
                ],
            },
        )

    @patch("sentry.profiles.flamegraph.bulk_snuba_queries")
    @patch("sentry.search.events.builder.base.raw_snql_query", wraps=raw_snql_query)
    @patch("sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service")
    def test_queries_profile_candidates_from_transactions_with_data(
        self,
        mock_proxy_profiling_service,
        mock_raw_snql_query,
        mock_bulk_snuba_queries,
    ):
        # this transaction has no transaction profile or continuous profile
        self.store_transaction(transaction="foo", project=self.project)

        # this transaction has transaction profile
        profile_id = uuid4().hex
        profile_transaction_id = uuid4().hex
        self.store_transaction(
            transaction="foo",
            profile_id=profile_id,
            transaction_id=profile_transaction_id,
            project=self.project,
        )

        # this transaction has continuous profile with a matching chunk (to be mocked below)
        profiler_id = uuid4().hex
        thread_id = "12345"
        profiler_transaction_id = uuid4().hex
        profiler_transaction = self.store_transaction(
            transaction="foo",
            profiler_id=profiler_id,
            thread_id=thread_id,
            transaction_id=profiler_transaction_id,
            project=self.project,
        )
        start_timestamp = datetime.fromtimestamp(profiler_transaction["start_timestamp"])
        finish_timestamp = datetime.fromtimestamp(profiler_transaction["timestamp"])
        buffer = timedelta(seconds=3)

        # this transaction has continuous profile without a chunk
        self.store_transaction(
            transaction="foo",
            profiler_id=uuid4().hex,
            project=self.project,
        )

        # not able to write profile chunks to the table yet so mock it's response here
        # so that the profiler transaction 1 looks like it has a profile chunk within
        # the specified time range
        chunk = {  # single chunk aligned to the transaction
            "project_id": self.project.id,
            "profiler_id": profiler_id,
            "chunk_id": uuid4().hex,
            "start_timestamp": (start_timestamp - buffer).isoformat(),
            "end_timestamp": (finish_timestamp + buffer).isoformat(),
        }
        mock_bulk_snuba_queries.return_value = [{"data": [chunk]}]

        mock_proxy_profiling_service.return_value = HttpResponse(status=200)

        response = self.do_request(
            {
                "project": [self.project.id],
                "query": "transaction:foo",
            },
        )
        assert response.status_code == 200, response.content

        # In practice, this should be called twice. But the second call is
        # mocked in this test due to the inability to write to the profile
        # chunks table.
        mock_raw_snql_query.assert_called_once()

        call_args = mock_raw_snql_query.call_args.args
        snql_request = call_args[0]

        assert snql_request.dataset == Dataset.Discover.value
        assert (
            Or(
                conditions=[
                    Condition(Column("profile_id"), Op.IS_NOT_NULL),
                    And(
                        conditions=[
                            Condition(Column("profiler_id"), Op.IS_NOT_NULL),
                            Condition(
                                Function("has", [Column("contexts.key"), "trace.thread_id"]),
                                Op.EQ,
                                1,
                            ),
                        ],
                    ),
                ],
            )
            in snql_request.query.where
        )
        assert Condition(Column("transaction"), Op.EQ, "foo") in snql_request.query.where

        mock_proxy_profiling_service.assert_called_once_with(
            method="POST",
            path=f"/organizations/{self.project.organization.id}/flamegraph",
            json_data={
                "transaction": [
                    {
                        "project_id": self.project.id,
                        "profile_id": profile_id,
                    },
                ],
                "continuous": [
                    {
                        "project_id": self.project.id,
                        "profiler_id": profiler_id,
                        "chunk_id": chunk["chunk_id"],
                        "thread_id": thread_id,
                        "start": str(int(profiler_transaction["start_timestamp"] * 1e9)),
                        "end": str(int(profiler_transaction["timestamp"] * 1e9)),
                        "transaction_id": profiler_transaction_id,
                    },
                ],
            },
        )

    def test_queries_profile_candidates_from_profiles_with_continuous_profiles_without_transactions(
        self,
    ):
        # this transaction has transaction profile
        profile_id = uuid4().hex
        profile_transaction = self.store_transaction(
            transaction="foo",
            profile_id=profile_id,
            project=self.project,
        )
        transaction = {
            "project.id": self.project.id,
            "profile.id": profile_id,
            "timestamp": datetime.fromtimestamp(profile_transaction["timestamp"]).isoformat(),
            "profiler.id": None,
            "thread.id": None,
            "precise.start_ts": datetime.fromtimestamp(
                profile_transaction["start_timestamp"]
            ).timestamp(),
            "precise.finish_ts": datetime.fromtimestamp(
                profile_transaction["timestamp"]
            ).timestamp(),
        }

        # this transaction has continuous profile with a matching chunk (to be mocked below)
        profiler_id = uuid4().hex
        thread_id = "12345"
        profiler_transaction = self.store_transaction(
            transaction="foo",
            profiler_id=profiler_id,
            thread_id=thread_id,
            project=self.project,
        )
        start_timestamp = datetime.fromtimestamp(profiler_transaction["start_timestamp"])
        finish_timestamp = datetime.fromtimestamp(profiler_transaction["timestamp"])
        buffer = timedelta(seconds=3)
        # not able to write profile chunks to the table yet so mock it's response here
        # so that the profiler transaction 1 looks like it has a profile chunk within
        # the specified time range
        chunk = {
            "project_id": self.project.id,
            "profiler_id": profiler_id,
            "chunk_id": uuid4().hex,
            "start_timestamp": (start_timestamp - buffer).isoformat(),
            "end_timestamp": (finish_timestamp + buffer).isoformat(),
        }

        with (
            patch(
                "sentry.profiles.flamegraph.bulk_snuba_queries", wraps=bulk_snuba_queries
            ) as mock_bulk_snuba_queries,
            patch(
                "sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service"
            ) as mock_proxy_profiling_service,
        ):
            mock_bulk_snuba_queries.return_value = [
                {"data": [transaction]},
                {"data": [chunk]},
            ]
            mock_proxy_profiling_service.return_value = HttpResponse(status=200)

            response = self.do_request(
                {
                    "project": [self.project.id],
                    "dataSource": "profiles",
                },
            )

            assert response.status_code == 200, response.content

            mock_bulk_snuba_queries.assert_called_once()

            call_args = mock_bulk_snuba_queries.call_args.args
            [transactions_snql_request, profiles_snql_request] = call_args[0]

            assert transactions_snql_request.dataset == Dataset.Discover.value
            assert (
                Or(
                    conditions=[
                        Condition(Column("profile_id"), Op.IS_NOT_NULL),
                        And(
                            conditions=[
                                Condition(Column("profiler_id"), Op.IS_NOT_NULL),
                                Condition(
                                    Function("has", [Column("contexts.key"), "trace.thread_id"]),
                                    Op.EQ,
                                    1,
                                ),
                            ],
                        ),
                    ],
                )
                in transactions_snql_request.query.where
            )

            assert profiles_snql_request.dataset == Dataset.Profiles.value

            mock_proxy_profiling_service.assert_called_once_with(
                method="POST",
                path=f"/organizations/{self.project.organization.id}/flamegraph",
                json_data={
                    "transaction": [
                        {
                            "project_id": self.project.id,
                            "profile_id": profile_id,
                        },
                    ],
                    "continuous": [
                        {
                            "project_id": self.project.id,
                            "profiler_id": profiler_id,
                            "chunk_id": chunk["chunk_id"],
                            "start": str(int((start_timestamp - buffer).timestamp() * 1e9)),
                            "end": str(int((finish_timestamp + buffer).timestamp() * 1e9)),
                        },
                    ],
                },
            )

    def test_queries_profile_candidates_from_profiles_with_continuous_profiles_with_transactions(
        self,
    ):
        # this transaction has transaction profile
        profile_id = uuid4().hex
        profile_transaction_id = uuid4().hex
        profile_transaction = self.store_transaction(
            transaction="foo",
            profile_id=profile_id,
            transaction_id=profile_transaction_id,
            project=self.project,
        )
        transaction_1 = {
            "id": profile_transaction_id,
            "project.id": self.project.id,
            "profile.id": profile_id,
            "timestamp": datetime.fromtimestamp(profile_transaction["timestamp"]).isoformat(),
            "profiler.id": None,
            "thread.id": None,
            "precise.start_ts": datetime.fromtimestamp(
                profile_transaction["start_timestamp"]
            ).timestamp(),
            "precise.finish_ts": datetime.fromtimestamp(
                profile_transaction["timestamp"]
            ).timestamp(),
        }

        # this transaction has continuous profile with a matching chunk (to be mocked below)
        profiler_id = uuid4().hex
        thread_id = "12345"
        profiler_transaction_id = uuid4().hex
        profiler_transaction = self.store_transaction(
            transaction="foo",
            profile_id=profiler_id,
            thread_id=thread_id,
            transaction_id=profiler_transaction_id,
            project=self.project,
        )
        transaction_2 = {
            "id": profiler_transaction_id,
            "project.id": self.project.id,
            "profile.id": None,
            "timestamp": datetime.fromtimestamp(profile_transaction["timestamp"]).isoformat(),
            "profiler.id": profiler_id,
            "thread.id": thread_id,
            "precise.start_ts": datetime.fromtimestamp(
                profile_transaction["start_timestamp"]
            ).timestamp(),
            "precise.finish_ts": datetime.fromtimestamp(
                profile_transaction["timestamp"]
            ).timestamp(),
        }

        start_timestamp = datetime.fromtimestamp(profile_transaction["start_timestamp"])
        finish_timestamp = datetime.fromtimestamp(profile_transaction["timestamp"])
        buffer = timedelta(seconds=3)
        # not able to write profile chunks to the table yet so mock it's response here
        # so that the profiler transaction 1 looks like it has a profile chunk within
        # the specified time range
        chunk_1 = {
            "project_id": self.project.id,
            "profiler_id": profiler_id,
            "chunk_id": uuid4().hex,
            "start_timestamp": (start_timestamp - buffer).isoformat(),
            "end_timestamp": (finish_timestamp + buffer).isoformat(),
        }

        # a random chunk that could be chosen but will not because we have a chunk
        # associated to a profile
        chunk_2 = {
            "project_id": self.project.id,
            "profiler_id": uuid4().hex,
            "chunk_id": uuid4().hex,
            "start_timestamp": (start_timestamp - buffer).isoformat(),
            "end_timestamp": (finish_timestamp + buffer).isoformat(),
        }

        with (
            patch("sentry.profiles.flamegraph.bulk_snuba_queries") as mock_bulk_snuba_queries,
            patch(
                "sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service"
            ) as mock_proxy_profiling_service,
        ):
            mock_bulk_snuba_queries.side_effect = [
                [
                    {"data": [transaction_1, transaction_2]},
                    {"data": [chunk_1, chunk_2]},
                ],
                [{"data": [chunk_1]}],
            ]
            mock_proxy_profiling_service.return_value = HttpResponse(status=200)

            response = self.do_request(
                {
                    "project": [self.project.id],
                    "dataSource": "profiles",
                },
            )

            assert response.status_code == 200, response.content

            assert mock_bulk_snuba_queries.call_count == 2

            first_call_args = mock_bulk_snuba_queries.call_args_list[0][0]
            [transactions_snql_request, profiles_snql_request] = first_call_args[0]

            assert transactions_snql_request.dataset == Dataset.Discover.value
            assert (
                Or(
                    conditions=[
                        Condition(Column("profile_id"), Op.IS_NOT_NULL),
                        And(
                            conditions=[
                                Condition(Column("profiler_id"), Op.IS_NOT_NULL),
                                Condition(
                                    Function("has", [Column("contexts.key"), "trace.thread_id"]),
                                    Op.EQ,
                                    1,
                                ),
                            ],
                        ),
                    ],
                )
                in transactions_snql_request.query.where
            )

            assert profiles_snql_request.dataset == Dataset.Profiles.value

            second_call_args = mock_bulk_snuba_queries.call_args_list[1][0]
            [profiles_snql_request] = second_call_args[0]
            assert profiles_snql_request.dataset == Dataset.Profiles.value

            mock_proxy_profiling_service.assert_called_once_with(
                method="POST",
                path=f"/organizations/{self.project.organization.id}/flamegraph",
                json_data={
                    "transaction": [
                        {
                            "project_id": self.project.id,
                            "profile_id": profile_id,
                        },
                    ],
                    "continuous": [
                        {
                            "project_id": self.project.id,
                            "profiler_id": profiler_id,
                            "chunk_id": chunk_1["chunk_id"],
                            "thread_id": thread_id,
                            "start": str(int(profiler_transaction["start_timestamp"] * 1e9)),
                            "end": str(int(profiler_transaction["timestamp"] * 1e9)),
                            "transaction_id": profiler_transaction_id,
                        },
                    ],
                },
            )


class OrganizationProfilingChunksTest(APITestCase):
    endpoint = "sentry-api-0-organization-profiling-chunks"
    features = {"organizations:continuous-profiling": True, "organizations:global-views": True}

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_forbids_multiple_projects(self):
        projects = [self.create_project() for _ in range(3)]

        with self.feature(self.features):
            response = self.client.get(self.url, {"project": [project.id for project in projects]})

        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="one project_id must be specified.", code="parse_error")
        }

    def test_requires_profiler_id(self):
        with self.feature(self.features):
            response = self.client.get(self.url, {"project": [self.project.id]})

        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="profiler_id must be specified.", code="parse_error")
        }

    @patch(
        "sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service",
        wraps=proxy_profiling_service,
    )
    @patch("sentry.profiles.profile_chunks.raw_snql_query")
    @freeze_time("2024-07-11 00:00:00")
    def test_proxies_to_profiling_service(self, mock_raw_snql_query, mock_proxy_profiling_service):
        profiler_id = uuid4().hex

        chunk_ids = [uuid4().hex for _ in range(3)]

        mock_raw_snql_query.return_value = {
            "data": [{"chunk_id": chunk_id} for chunk_id in chunk_ids]
        }

        with self.feature(self.features):
            self.client.get(
                self.url,
                {
                    "project": [self.project.id],
                    "profiler_id": profiler_id,
                    "statsPeriod": "1d",
                },
            )

        end = datetime.fromisoformat("2024-07-11 00:00:00").replace(tzinfo=UTC)
        start = end - timedelta(days=1)

        mock_proxy_profiling_service.assert_called_with(
            method="POST",
            path=f"/organizations/{self.project.organization.id}/projects/{self.project.id}/chunks",
            json_data={
                "profiler_id": profiler_id,
                "chunk_ids": chunk_ids,
                "start": str(int(start.timestamp() * 1e9)),
                "end": str(int(end.timestamp() * 1e9)),
            },
        )
