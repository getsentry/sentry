from unittest import mock
from uuid import uuid4

from django.urls import reverse

from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationSpansTagsEndpointTest(BaseSpansTestCase, APITestCase):
    is_eap = False
    view = "sentry-api-0-organization-spans-fields"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query=None, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer"]
        with self.feature(features):
            return self.client.get(
                reverse(self.view, kwargs={"organization_id_or_slug": self.organization.slug}),
                query,
                format="json",
                **kwargs,
            )

    def test_no_feature(self):
        response = self.do_request(features=[])
        assert response.status_code == 404, response.data

    def test_no_project(self):
        response = self.do_request()
        assert response.status_code == 200, response.data
        assert response.data == []

    def test_tags_list(self):
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={tag: tag},
                is_eap=self.is_eap,
            )

        for features in [
            None,  # use the default features
            ["organizations:performance-trace-explorer"],
        ]:
            response = self.do_request(features=features)
            assert response.status_code == 200, response.data
            assert response.data == [
                {"key": "bar", "name": "Bar"},
                {"key": "baz", "name": "Baz"},
                {"key": "foo", "name": "Foo"},
            ]


class OrganizationEAPSpansTagsEndpointTest(OrganizationSpansTagsEndpointTest):
    is_eap = True

    def do_request(self, query=None, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer"]

        features.append("organizations:visibility-explore-dataset")

        if query is None:
            query = {}
        query["dataset"] = "spans"
        if "type" not in query:
            query["type"] = "string"

        with self.feature(features):
            return self.client.get(
                reverse(self.view, kwargs={"organization_id_or_slug": self.organization.slug}),
                query,
                format="json",
                **kwargs,
            )

    def test_tags_list(self):
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={tag: tag},
                is_eap=self.is_eap,
            )

        for features in [
            None,  # use the default features
            ["organizations:performance-trace-explorer"],
        ]:
            response = self.do_request(
                features=features, query={"dataset": "spans", "type": "string"}
            )
            assert response.status_code == 200, response.data
            assert {"key": "bar", "name": "Bar"} in response.data
            assert {"key": "foo", "name": "Foo"} in response.data
            assert {"key": "baz", "name": "Baz"} in response.data
            # Skipping for now
            # assert response.data == [
            #     {"key": "span.description", "name": "Span.Description"},
            #     {"key": "transaction", "name": "Transaction"},
            #     {"key": "project", "name": "Project"},
            # ]

    def test_tags_list_nums(self):
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction="foo",
                duration=100,
                exclusive_time=100,
                measurements={tag: 0},
                is_eap=self.is_eap,
            )

        for features in [
            None,  # use the default features
            ["organizations:performance-trace-explorer"],
        ]:
            response = self.do_request(
                features=features, query={"dataset": "spans", "type": "number"}
            )
            assert response.status_code == 200, response.data
            assert {"key": "bar", "name": "Bar"} in response.data
            assert {"key": "foo", "name": "Foo"} in response.data
            assert {"key": "baz", "name": "Baz"} in response.data


class OrganizationSpansTagKeyValuesEndpointTest(BaseSpansTestCase, APITestCase):
    is_eap = False
    view = "sentry-api-0-organization-spans-fields-values"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, key: str, query=None, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer"]
        with self.feature(features):
            return self.client.get(
                reverse(
                    self.view,
                    kwargs={"organization_id_or_slug": self.organization.slug, "key": key},
                ),
                query,
                format="json",
                **kwargs,
            )

    def test_no_feature(self):
        response = self.do_request("tag", features=[])
        assert response.status_code == 404, response.data

    def test_no_project(self):
        response = self.do_request("tag")
        assert response.status_code == 200, response.data
        assert response.data == []

    def test_tags_keys(self):
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=self.is_eap,
            )

        response = self.do_request("tag")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "bar",
                "name": "bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "baz",
                "name": "baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_transaction_keys_autocomplete(self):
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for transaction in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=transaction,
                duration=100,
                exclusive_time=100,
                is_eap=self.is_eap,
            )

        key = "transaction"

        response = self.do_request(key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_transaction_keys_autocomplete_substring(self):
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for transaction in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=transaction,
                duration=100,
                exclusive_time=100,
                is_eap=self.is_eap,
            )

        key = "transaction"

        response = self.do_request(key, query={"query": "b"})
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_transaction_keys_autocomplete_substring_with_asterisk(self):
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for transaction in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=transaction,
                duration=100,
                exclusive_time=100,
                is_eap=self.is_eap,
            )

        key = "transaction"

        response = self.do_request(key, query={"query": r"\*b"})
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete(self):
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="transaction",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=self.is_eap,
            )

        key = "tag"

        response = self.do_request(key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_substring(self):
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="transaction",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=self.is_eap,
            )

        key = "tag"

        response = self.do_request(key, query={"query": "b"})
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_substring_with_asterisks(self):
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="transaction",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=self.is_eap,
            )

        key = "tag"

        response = self.do_request(key, query={"query": r"\*b"})
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_noop(self):
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=tag,
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=self.is_eap,
            )

        for key in [
            "span.duration",
            "span.self_time",
            "timestamp",
            "id",
            "span_id",
            "parent_span",
            "parent_span_id",
            "trace",
            "trace_id",
            "transaction.id",
            "transaction_id",
            "segment.id",
            "segment_id",
            "profile.id",
            "profile_id",
            "replay.id",
            "replay_id",
        ]:
            response = self.do_request(key)
            assert response.status_code == 200, response.data
            assert response.data == [], key

    def test_tags_keys_autocomplete_project(self):
        base_id = 9223372036854775000
        self.create_project(id=base_id + 100, name="foo")
        self.create_project(id=base_id + 299, name="bar")
        self.create_project(id=base_id + 399, name="baz")

        features = [
            "organizations:performance-trace-explorer",
            "organizations:global-views",
        ]

        for key in ["project", "project.name"]:
            response = self.do_request(key, features=features)
            assert response.status_code == 200, response.data
            assert sorted(response.data, key=lambda v: v["value"]) == [
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "bar",
                    "name": "bar",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "baz",
                    "name": "baz",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "foo",
                    "name": "foo",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
            ]

            response = self.do_request(key, query={"query": "ba"}, features=features)
            assert response.status_code == 200, response.data
            assert sorted(response.data, key=lambda v: v["value"]) == [
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "bar",
                    "name": "bar",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "baz",
                    "name": "baz",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
            ]

        key = "project.id"

        response = self.do_request(key, features=features)
        assert response.status_code == 200, response.data
        assert sorted(response.data, key=lambda v: v["value"]) == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "9223372036854775100",
                "name": "9223372036854775100",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "9223372036854775299",
                "name": "9223372036854775299",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "9223372036854775399",
                "name": "9223372036854775399",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

        response = self.do_request(key, query={"query": "99"}, features=features)
        assert response.status_code == 200, response.data
        assert sorted(response.data, key=lambda v: v["value"]) == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "9223372036854775299",
                "name": "9223372036854775299",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "9223372036854775399",
                "name": "9223372036854775399",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_span_status(self):
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for status in ["ok", "internal_error", "invalid_argument"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="foo",
                status=status,
                is_eap=self.is_eap,
            )

        response = self.do_request("span.status")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "span.status",
                "value": "internal_error",
                "name": "internal_error",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "span.status",
                "value": "invalid_argument",
                "name": "invalid_argument",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "span.status",
                "value": "ok",
                "name": "ok",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

        response = self.do_request("span.status", query={"query": "in"})
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "span.status",
                "value": "internal_error",
                "name": "internal_error",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "span.status",
                "value": "invalid_argument",
                "name": "invalid_argument",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]


class OrganizationEAPSpansTagKeyValuesEndpointTest(OrganizationSpansTagKeyValuesEndpointTest):
    is_eap = True

    def do_request(self, key: str, query=None, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer"]

        features.append("organizations:visibility-explore-dataset")

        if query is None:
            query = {}
        query["dataset"] = "spans"
        query["type"] = "string"

        with self.feature(features):
            return self.client.get(
                reverse(
                    self.view,
                    kwargs={"organization_id_or_slug": self.organization.slug, "key": key},
                ),
                query,
                format="json",
                **kwargs,
            )
