from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from django.http import HttpResponse
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail
from snuba_sdk import Column, Condition, Function, Op, Or

from sentry.profiles.flamegraph import FlamegraphExecutor
from sentry.profiles.utils import proxy_profiling_service
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase, ProfilesSnubaTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.utils.samples import load_data
from sentry.utils.snuba import raw_snql_query


class OrganizationProfilingFlamegraphTestLegacy(APITestCase):
    endpoint = "sentry-api-0-organization-profiling-flamegraph"
    features = {"organizations:profiling": True}

    def setUp(self):
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    @patch("sentry.search.events.builder.base.raw_snql_query", wraps=raw_snql_query)
    @patch("sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service")
    def test_queries_functions(self, mock_proxy_profiling_service, mock_raw_snql_query):
        mock_proxy_profiling_service.return_value = HttpResponse(status=200)

        fingerprint = int(uuid4().hex[:8], 16)

        with self.feature(self.features):
            response = self.client.get(
                self.url,
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

        with self.feature(self.features):
            response = self.client.get(
                self.url,
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
        project=None,
    ):
        data = load_data("transaction", timestamp=self.ten_mins_ago)

        if transaction is not None:
            data["transaction"] = transaction

        if profile_id is not None:
            data.setdefault("contexts", {}).setdefault("profile", {})["profile_id"] = profile_id

        if profiler_id is not None:
            data.setdefault("contexts", {}).setdefault("profile", {})["profiler_id"] = profiler_id

        self.store_event(data, project_id=project.id if project else self.project.id)

        return data

    def test_invalid_params(self):
        with self.feature(self.features):
            response = self.do_request(
                {
                    "project": [self.project.id],
                    "dataset": "foo",
                    "fingerprint": str(1 << 32),
                },
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "dataset": [ErrorDetail('"foo" is not a valid choice.', code="invalid_choice")],
            "fingerprint": [
                ErrorDetail(
                    string="Ensure this value is less than or equal to 4294967295.",
                    code="max_value",
                )
            ],
        }

    def test_discover_dataset_with_fingerprint_invalid(self):
        with self.feature(self.features):
            response = self.do_request(
                {
                    "project": [self.project.id],
                    "dataset": "discover",
                    "fingerprint": "1",
                },
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": ErrorDetail(
                '"fingerprint" is only permitted when using dataset: "functions"',
                code="parse_error",
            ),
        }

    @patch("sentry.search.events.builder.base.raw_snql_query", wraps=raw_snql_query)
    @patch("sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service")
    def test_queries_profile_candidates_from_functions(
        self, mock_proxy_profiling_service, mock_raw_snql_query
    ):
        mock_proxy_profiling_service.return_value = HttpResponse(status=200)
        fingerprint = int(uuid4().hex[:8], 16)

        with self.feature(self.features):
            response = self.do_request(
                {
                    "project": [self.project.id],
                    "dataset": "functions",
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

    @patch.object(FlamegraphExecutor, "_query_chunks_for_profilers")
    @patch("sentry.search.events.builder.base.raw_snql_query", wraps=raw_snql_query)
    @patch("sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service")
    def test_queries_profile_candidates_from_transactions(
        self,
        mock_proxy_profiling_service,
        mock_raw_snql_query,
        mock_query_chunks_for_profilers,
    ):
        self.store_transaction(transaction="foo", project=self.project)

        profile_id = uuid4().hex
        self.store_transaction(
            transaction="foo",
            profile_id=profile_id,
            project=self.project,
        )

        profiler_id = uuid4().hex
        profiler_transaction = self.store_transaction(
            transaction="foo",
            profiler_id=profiler_id,
            project=self.project,
        )

        profiler_transaction = self.store_transaction(
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
            "start": datetime.fromtimestamp(profiler_transaction["start_timestamp"]).isoformat(),
            "end": datetime.fromtimestamp(profiler_transaction["timestamp"]).isoformat(),
        }
        mock_query_chunks_for_profilers.return_value = {"data": [chunk]}

        mock_proxy_profiling_service.return_value = HttpResponse(status=200)

        with self.feature(self.features):
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
                    Condition(Column("profiler_id"), Op.IS_NOT_NULL),
                ],
            )
            in snql_request.query.where
        )
        assert Condition(Column("transaction"), Op.EQ, "foo") in snql_request.query.where

        mock_proxy_profiling_service.assert_called_once_with(
            method="POST",
            path=f"/organizations/{self.project.organization.id}/flamegraph",
            json_data=[
                {
                    "project_id": self.project.id,
                    "profiler_id": profiler_id,
                    "chunk_id": chunk["chunk_id"],
                    "start": str(int(profiler_transaction["start_timestamp"] * 1e9)),
                    "end": str(int(profiler_transaction["timestamp"] * 1e9)),
                },
                {
                    "project_id": self.project.id,
                    "profile_id": profile_id,
                },
            ],
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
