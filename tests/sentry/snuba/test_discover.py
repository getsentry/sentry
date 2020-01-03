from __future__ import absolute_import

from sentry import eventstore
from sentry.api.event_search import InvalidSearchQuery
from sentry.snuba import discover
from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils.samples import load_data
from sentry.utils.snuba import Dataset

from mock import patch
from datetime import timedelta

import six
import pytest


class QueryIntegrationTest(SnubaTestCase, TestCase):
    def setUp(self):
        super(QueryIntegrationTest, self).setUp()
        self.environment = self.create_environment(self.project, name="prod")
        self.release = self.create_release(self.project, version="first-release")

        self.event = self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )

    def test_field_aliasing_in_selected_columns(self):
        result = discover.query(
            selected_columns=["project.id", "user.email", "release"],
            query="",
            params={"project_id": [self.project.id]},
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user.email"] == "bruce@example.com"
        assert data[0]["release"] == "first-release"

        assert len(result["meta"]) == 3
        assert result["meta"][0] == {"name": "project.id", "type": "UInt64"}
        assert result["meta"][1] == {"name": "user.email", "type": "Nullable(String)"}
        assert result["meta"][2] == {"name": "release", "type": "Nullable(String)"}

    def test_field_aliasing_in_aggregate_functions_and_groupby(self):
        result = discover.query(
            selected_columns=["project.id", "count_unique(user.email)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["count_unique_user_email"] == 1

    def test_field_aliasing_in_conditions(self):
        result = discover.query(
            selected_columns=["project.id", "user.email"],
            query="user.email:bruce@example.com",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user.email"] == "bruce@example.com"

    def test_auto_fields_simple_fields(self):
        result = discover.query(
            selected_columns=["user.email", "release"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["id"] == self.event.event_id
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user.email"] == "bruce@example.com"
        assert data[0]["release"] == "first-release"

        assert len(result["meta"]) == 4
        assert result["meta"][0] == {"name": "user.email", "type": "Nullable(String)"}
        assert result["meta"][1] == {"name": "release", "type": "Nullable(String)"}
        assert result["meta"][2] == {"name": "id", "type": "FixedString(32)"}
        assert result["meta"][3] == {"name": "project.id", "type": "UInt64"}

    def test_auto_fields_aggregates(self):
        result = discover.query(
            selected_columns=["count_unique(user.email)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["projectid"] == self.project.id
        assert data[0]["latest_event"] == self.event.event_id
        assert data[0]["count_unique_user_email"] == 1

    def test_release_condition(self):
        result = discover.query(
            selected_columns=["id", "message"],
            query="release:{}".format(self.create_release(self.project).version),
            params={"project_id": [self.project.id]},
        )
        assert len(result["data"]) == 0

        result = discover.query(
            selected_columns=["id", "message"],
            query="release:{}".format(self.release.version),
            params={"project_id": [self.project.id]},
        )
        assert len(result["data"]) == 1
        data = result["data"]
        assert data[0]["id"] == self.event.event_id
        assert data[0]["message"] == self.event.message
        assert "event_id" not in data[0]

    def test_environment_condition(self):
        result = discover.query(
            selected_columns=["id", "message"],
            query="environment:{}".format(self.create_environment(self.project).name),
            params={"project_id": [self.project.id]},
        )
        assert len(result["data"]) == 0

        result = discover.query(
            selected_columns=["id", "message"],
            query="environment:{}".format(self.environment.name),
            params={"project_id": [self.project.id]},
        )
        assert len(result["data"]) == 1
        data = result["data"]
        assert data[0]["id"] == self.event.event_id
        assert data[0]["message"] == self.event.message

    def test_reference_event(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": iso_format(before_now(minutes=2)),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "no match",
                "timestamp": iso_format(before_now(minutes=2)),
            },
            project_id=self.project.id,
        )
        ref = discover.ReferenceEvent(
            self.organization, "{}:{}".format(self.project.slug, "a" * 32), ["message", "count()"]
        )
        result = discover.query(
            selected_columns=["id", "message"],
            query="",
            reference_event=ref,
            params={"project_id": [self.project.id]},
        )
        assert len(result["data"]) == 2
        for row in result["data"]:
            assert row["message"] == "oh no"


class QueryTransformTest(TestCase):
    """
    This test mocks snuba.raw_query to let us isolate column transformations.
    """

    @patch("sentry.snuba.discover.raw_query")
    def test_query_parse_error(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=[],
                query="foo(id):<1dino",
                params={"project_id": [self.project.id]},
            )
        assert mock_query.call_count == 0

    @patch("sentry.snuba.discover.raw_query")
    def test_query_no_fields(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        with pytest.raises(InvalidSearchQuery) as err:
            discover.query(
                selected_columns=[],
                query="event.type:transaction",
                params={"project_id": [self.project.id]},
            )
        assert "No fields" in six.text_type(err)
        assert mock_query.call_count == 0

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_field_alias_macro(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "user_id"}, {"name": "email"}],
            "data": [{"user_id": "1", "email": "a@example.org"}],
        }
        discover.query(
            selected_columns=["user", "project"], query="", params={"project_id": [self.project.id]}
        )
        mock_query.assert_called_with(
            selected_columns=["user_id", "username", "email", "ip_address", "project_id"],
            aggregations=[],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_no_auto_fields(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "user_id"}, {"name": "email"}],
            "data": [{"user_id": "1", "email": "a@example.org"}],
        }
        discover.query(
            selected_columns=["count()"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=False,
        )
        mock_query.assert_called_with(
            selected_columns=[],
            aggregations=[["count", None, "count"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_aliasing_in_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "transaction.duration",
                "count_unique(transaction.duration)",
            ],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            aggregations=[
                ["uniq", "duration", "count_unique_transaction_duration"],
                ["argMax", ["event_id", "timestamp"], "latest_event"],
                ["argMax", ["project_id", "timestamp"], "projectid"],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=["transaction", "duration"],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_aggregate_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "p95"}],
            "data": [{"transaction": "api.do_things", "p95": 200}],
        }
        discover.query(
            selected_columns=["transaction", "p95", "count_unique(transaction)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                ["quantile(0.95)(duration)", None, "p95"],
                ["uniq", "transaction", "count_unique_transaction"],
                ["argMax", ["event_id", "timestamp"], "latest_event"],
                ["argMax", ["project_id", "timestamp"], "projectid"],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_orderby_limit_offset(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "title"}, {"name": "project.id"}],
            "data": [{"project.id": "tester", "title": "test title"}],
        }
        discover.query(
            selected_columns=["project.id", "title"],
            query="",
            params={"project_id": [self.project.id]},
            orderby=["project.id"],
            offset=100,
            limit=200,
        )
        mock_query.assert_called_with(
            selected_columns=["project_id", "title"],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            orderby=["project_id"],
            aggregations=[],
            end=None,
            start=None,
            conditions=[],
            groupby=[],
            limit=200,
            offset=100,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_orderby_must_be_selected_if_aggregate(self, mock_query):
        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=["transaction", "transaction.duration"],
                query="",
                params={"project_id": [self.project.id]},
                orderby=["count()"],
            )
        assert mock_query.call_count == 0

    @patch("sentry.snuba.discover.raw_query")
    def test_orderby_aggregate_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "count_id"}, {"name": "project.id"}],
            "data": [{"project.id": "tester", "count_id": 10}],
        }
        discover.query(
            selected_columns=["count(id)", "project.id", "id"],
            query="",
            params={"project_id": [self.project.id]},
            orderby=["count_id"],
        )
        mock_query.assert_called_with(
            selected_columns=["project_id", "event_id"],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            orderby=["count_id"],
            aggregations=[["count", None, "count_id"]],
            end=None,
            start=None,
            conditions=[],
            groupby=["project_id", "event_id"],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_conditions_order_and_groupby_aliasing(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        discover.query(
            selected_columns=["timestamp", "transaction", "transaction.duration", "count()"],
            query="transaction.duration:200 sdk.name:python tags[projectid]:123",
            params={"project_id": [self.project.id]},
            orderby=["-timestamp", "-count"],
        )
        mock_query.assert_called_with(
            selected_columns=["timestamp", "transaction", "duration"],
            aggregations=[["count", None, "count"]],
            conditions=[
                ["duration", "=", 200],
                ["sdk_name", "=", "python"],
                [["ifNull", ["tags[projectid]", "''"]], "=", "123"],
            ],
            filter_keys={"project_id": [self.project.id]},
            groupby=["timestamp", "transaction", "duration"],
            orderby=["-timestamp", "-count"],
            dataset=Dataset.Discover,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_conditions_nested_function_aliasing(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}],
            "data": [{"transaction": "api.do_things"}],
        }
        discover.query(
            selected_columns=["transaction", "count()"],
            query="event.type:transaction user.email:*@sentry.io message:recent-searches",
            params={"project_id": [self.project.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[
                ["type", "=", "transaction"],
                [["match", ["email", "'(?i)^.*\@sentry\.io$'"]], "=", 1],
                [["positionCaseInsensitive", ["message", "'recent-searches'"]], "!=", 0],
            ],
            aggregations=[["count", None, "count"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_condition_transform(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query="http.method:GET",
            params={"project_id": [self.project.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_condition_projectid_transform(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        # The project_id column is not a public column, but we
        # have to let it through in conditions to ensure project.name works.
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query="project_id:1",
            params={"project_id": [self.project.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["project_id", "=", 1]],
            filter_keys={"project_id": [self.project.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_condition_projectname_transform(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        project2 = self.create_project(organization=self.organization)

        # project.name is in the public schema and should be converted to a
        # project_id condition.
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query="project.name:{}".format(project2.slug),
            params={"project_id": [self.project.id, project2.id]},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["project_id", "=", project2.id]],
            filter_keys={"project_id": [self.project.id, project2.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            orderby=None,
            end=None,
            start=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_params_forward(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)
        discover.query(
            selected_columns=["transaction", "transaction.duration"],
            query="http.method:GET",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
        )
        mock_query.assert_called_with(
            selected_columns=["transaction", "duration"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )


class TimeseriesQueryTest(SnubaTestCase, TestCase):
    def setUp(self):
        super(TimeseriesQueryTest, self).setUp()

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "very bad",
                "timestamp": iso_format(self.day_ago + timedelta(hours=1)),
                "fingerprint": ["group1"],
                "tags": {"important": "yes"},
                "user": {"id": 1},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh my",
                "timestamp": iso_format(self.day_ago + timedelta(hours=1, minutes=1)),
                "fingerprint": ["group2"],
                "tags": {"important": "no"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "very bad",
                "timestamp": iso_format(self.day_ago + timedelta(hours=2, minutes=1)),
                "fingerprint": ["group2"],
                "tags": {"important": "yes"},
            },
            project_id=self.project.id,
        )

    def test_invalid_field_in_function(self):
        with pytest.raises(InvalidSearchQuery):
            discover.timeseries_query(
                selected_columns=["min(transaction)"],
                query="transaction:api.issue.delete",
                params={"project_id": [self.project.id]},
                rollup=1800,
            )

    def test_missing_start_and_end(self):
        with pytest.raises(InvalidSearchQuery) as err:
            discover.timeseries_query(
                selected_columns=["count()"],
                query="transaction:api.issue.delete",
                params={"project_id": [self.project.id]},
                rollup=1800,
            )
        assert "without a start and end" in six.text_type(err)

    def test_no_aggregations(self):
        with pytest.raises(InvalidSearchQuery) as err:
            discover.timeseries_query(
                selected_columns=["transaction", "title"],
                query="transaction:api.issue.delete",
                params={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=2),
                    "project_id": [self.project.id],
                },
                rollup=1800,
            )
        assert "no aggregation" in six.text_type(err)

    def test_field_alias(self):
        result = discover.timeseries_query(
            selected_columns=["p95"],
            query="event.type:transaction transaction:api.issue.delete",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3

    def test_aggregate_function(self):
        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        assert [2] == [val["count"] for val in result.data["data"] if "count" in val]

        result = discover.timeseries_query(
            selected_columns=["count_unique(user)"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3
        keys = []
        for row in result.data["data"]:
            keys.extend(list(row.keys()))
        assert "count" in keys
        assert "time" in keys

    def test_zerofilling(self):
        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=3),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 4, "Should have empty results"
        assert [2, 1] == [
            val["count"] for val in result.data["data"] if "count" in val
        ], result.data["data"]

    def test_reference_event(self):
        ref = discover.ReferenceEvent(
            self.organization,
            "{}:{}".format(self.project.slug, "a" * 32),
            ["message", "count()", "last_seen"],
        )
        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=3),
                "project_id": [self.project.id],
            },
            reference_event=ref,
            rollup=3600,
        )
        assert len(result.data["data"]) == 4
        assert [1, 1] == [val["count"] for val in result.data["data"] if "count" in val]


class CreateReferenceEventConditionsTest(SnubaTestCase, TestCase):
    def test_bad_slug_format(self):
        ref = discover.ReferenceEvent(self.organization, "lol", [])
        with pytest.raises(InvalidSearchQuery):
            discover.create_reference_event_conditions(ref)

    def test_unknown_project(self):
        event = self.store_event(
            data={"message": "oh no!", "timestamp": iso_format(before_now(seconds=1))},
            project_id=self.project.id,
        )
        ref = discover.ReferenceEvent(self.organization, "nope:{}".format(event.event_id), [])
        with pytest.raises(InvalidSearchQuery):
            discover.create_reference_event_conditions(ref)

    def test_unknown_event(self):
        with pytest.raises(InvalidSearchQuery):
            slug = "{}:deadbeef".format(self.project.slug)
            ref = discover.ReferenceEvent(self.organization, slug, ["message"])
            discover.create_reference_event_conditions(ref)

    def test_unknown_event_and_no_fields(self):
        slug = "{}:deadbeef".format(self.project.slug)
        ref = discover.ReferenceEvent(self.organization, slug, [])
        result = discover.create_reference_event_conditions(ref)
        assert len(result) == 0

    def test_no_fields(self):
        event = self.store_event(
            data={
                "message": "oh no!",
                "transaction": "/issues/{issue_id}",
                "timestamp": iso_format(before_now(seconds=1)),
            },
            project_id=self.project.id,
        )
        slug = "{}:{}".format(self.project.slug, event.event_id)
        ref = discover.ReferenceEvent(self.organization, slug, [])
        result = discover.create_reference_event_conditions(ref)
        assert len(result) == 0

    def test_basic_fields(self):
        event = self.store_event(
            data={
                "message": "oh no!",
                "transaction": "/issues/{issue_id}",
                "timestamp": iso_format(before_now(seconds=1)),
            },
            project_id=self.project.id,
        )

        slug = "{}:{}".format(self.project.slug, event.event_id)
        ref = discover.ReferenceEvent(
            self.organization, slug, ["message", "transaction", "unknown-field"]
        )
        result = discover.create_reference_event_conditions(ref)
        assert result == [
            ["message", "=", "oh no! /issues/{issue_id}"],
            ["transaction", "=", "/issues/{issue_id}"],
        ]

    def test_geo_field(self):
        event = self.store_event(
            data={
                "message": "oh no!",
                "transaction": "/issues/{issue_id}",
                "user": {
                    "id": 1,
                    "geo": {"country_code": "US", "region": "CA", "city": "San Francisco"},
                },
                "timestamp": iso_format(before_now(seconds=1)),
            },
            project_id=self.project.id,
        )
        slug = "{}:{}".format(self.project.slug, event.event_id)
        ref = discover.ReferenceEvent(
            self.organization, slug, ["geo.city", "geo.region", "geo.country_code"]
        )
        result = discover.create_reference_event_conditions(ref)
        assert result == [
            ["geo.city", "=", "San Francisco"],
            ["geo.region", "=", "CA"],
            ["geo.country_code", "=", "US"],
        ]

    def test_sdk_field(self):
        event = self.store_event(
            data={
                "message": "oh no!",
                "transaction": "/issues/{issue_id}",
                "sdk": {"name": "sentry-python", "version": "5.0.12"},
                "timestamp": iso_format(before_now(seconds=1)),
            },
            project_id=self.project.id,
        )
        slug = "{}:{}".format(self.project.slug, event.event_id)
        ref = discover.ReferenceEvent(self.organization, slug, ["sdk.version", "sdk.name"])
        result = discover.create_reference_event_conditions(ref)
        assert result == [["sdk.version", "=", "5.0.12"], ["sdk.name", "=", "sentry-python"]]

    def test_error_field(self):
        data = load_data("php")
        data["timestamp"] = iso_format(before_now(seconds=1))
        event = self.store_event(data=data, project_id=self.project.id)

        slug = "{}:{}".format(self.project.slug, event.event_id)
        ref = discover.ReferenceEvent(
            self.organization, slug, ["error.value", "error.type", "error.handled"]
        )
        result = discover.create_reference_event_conditions(ref)
        assert result == [
            ["error.value", "=", "This is a test exception sent from the Raven CLI."],
            ["error.type", "=", "Exception"],
        ]

    def test_stack_field(self):
        data = load_data("php")
        data["timestamp"] = iso_format(before_now(seconds=1))
        event = self.store_event(data=data, project_id=self.project.id)

        slug = "{}:{}".format(self.project.slug, event.event_id)
        ref = discover.ReferenceEvent(self.organization, slug, ["stack.filename", "stack.function"])
        result = discover.create_reference_event_conditions(ref)
        assert result == [
            ["stack.filename", "=", "/Users/example/Development/raven-php/bin/raven"],
            ["stack.function", "=", "raven_cli_test"],
        ]

    def test_tag_value(self):
        event = self.store_event(
            data={
                "message": "oh no!",
                "timestamp": iso_format(before_now(seconds=1)),
                "tags": {"customer_id": 1, "color": "red"},
            },
            project_id=self.project.id,
        )
        slug = "{}:{}".format(self.project.slug, event.event_id)
        ref = discover.ReferenceEvent(self.organization, slug, ["nope", "color", "customer_id"])
        result = discover.create_reference_event_conditions(ref)
        assert result == [["color", "=", "red"], ["customer_id", "=", "1"]]

    def test_context_value(self):
        event = self.store_event(
            data={
                "message": "oh no!",
                "timestamp": iso_format(before_now(seconds=1)),
                "contexts": {
                    "os": {"version": "10.14.6", "type": "os", "name": "Mac OS X"},
                    "browser": {"type": "browser", "name": "Firefox", "version": "69"},
                    "gpu": {"type": "gpu", "name": "nvidia 8600", "vendor": "nvidia"},
                },
            },
            project_id=self.project.id,
        )
        slug = "{}:{}".format(self.project.slug, event.event_id)
        ref = discover.ReferenceEvent(self.organization, slug, ["gpu.name", "browser.name"])
        result = discover.create_reference_event_conditions(ref)
        assert result == [["gpu.name", "=", "nvidia 8600"], ["browser.name", "=", "Firefox"]]

    def test_issue_field(self):
        event = self.store_event(
            data={
                "message": "oh no!",
                "timestamp": iso_format(before_now(seconds=1)),
                "contexts": {
                    "os": {"version": "10.14.6", "type": "os", "name": "Mac OS X"},
                    "browser": {"type": "browser", "name": "Firefox", "version": "69"},
                    "gpu": {"type": "gpu", "name": "nvidia 8600", "vendor": "nvidia"},
                },
            },
            project_id=self.project.id,
        )
        slug = "{}:{}".format(self.project.slug, event.event_id)
        ref = discover.ReferenceEvent(self.organization, slug, ["issue.id"])
        result = discover.create_reference_event_conditions(ref)
        assert result == [["issue.id", "=", event.group_id]]


class GetPaginationIdsTest(SnubaTestCase, TestCase):
    def setUp(self):
        super(GetPaginationIdsTest, self).setUp()

        self.project = self.create_project()
        self.min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1)

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "very bad",
                "type": "default",
                "platform": "python",
                "timestamp": iso_format(before_now(minutes=4)),
                "tags": {"foo": "1"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "very bad",
                "type": "default",
                "platform": "python",
                "timestamp": iso_format(before_now(minutes=3)),
                "tags": {"foo": "1"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "very bad",
                "type": "default",
                "platform": "python",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"foo": "1"},
            },
            project_id=self.project.id,
        )
        self.event = eventstore.get_event_by_id(self.project.id, "b" * 32)

    def test_no_related_events(self):
        result = discover.get_pagination_ids(
            self.event,
            "foo:bar",
            {"project_id": [self.project.id], "start": self.min_ago, "end": self.day_ago},
        )
        assert result.previous is None
        assert result.next is None
        assert result.oldest is None
        assert result.latest is None

    def test_invalid_conditions(self):
        with pytest.raises(InvalidSearchQuery):
            discover.get_pagination_ids(
                self.event,
                "foo:(11",
                {"project_id": [self.project.id], "end": self.min_ago, "start": self.day_ago},
            )

    def test_matching_conditions(self):
        result = discover.get_pagination_ids(
            self.event,
            "foo:1",
            {"project_id": [self.project.id], "end": self.min_ago, "start": self.day_ago},
        )
        assert result.previous == "a" * 32
        assert result.next == "c" * 32
        assert result.oldest == "a" * 32
        assert result.latest == "c" * 32

    def test_reference_event_matching(self):
        # Create an event that won't match the reference
        self.store_event(
            data={
                "event_id": "d" * 32,
                "message": "completely bad",
                "type": "default",
                "platform": "python",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"foo": "1"},
            },
            project_id=self.project.id,
        )
        reference = discover.ReferenceEvent(
            self.organization, "{}:{}".format(self.project.slug, self.event.id), ["message"]
        )
        result = discover.get_pagination_ids(
            self.event,
            "foo:1",
            {"project_id": [self.project.id], "end": self.min_ago, "start": self.day_ago},
            reference_event=reference,
        )
        assert result.previous == "a" * 32
        assert result.next == "c" * 32
        assert result.oldest == "a" * 32
        assert result.latest == "c" * 32

    def test_date_params_included(self):
        # Create an event that is outside the date range
        self.store_event(
            data={
                "event_id": "d" * 32,
                "message": "very bad",
                "type": "default",
                "platform": "python",
                "timestamp": iso_format(before_now(days=2)),
                "tags": {"foo": "1"},
            },
            project_id=self.project.id,
        )
        result = discover.get_pagination_ids(
            self.event,
            "foo:1",
            {"project_id": [self.project.id], "end": self.min_ago, "start": self.day_ago},
        )
        assert result.previous == "a" * 32
        assert result.next == "c" * 32
        assert result.oldest == "a" * 32
        assert result.latest == "c" * 32


class GetFacetsTest(SnubaTestCase, TestCase):
    def setUp(self):
        super(GetFacetsTest, self).setUp()

        self.project = self.create_project()
        self.min_ago = before_now(minutes=1)
        self.day_ago = before_now(days=1)

    def test_invalid_query(self):
        with pytest.raises(InvalidSearchQuery):
            discover.get_facets(
                "\n", {"project_id": [self.project.id], "end": self.min_ago, "start": self.day_ago}
            )

    def test_no_results(self):
        results = discover.get_facets(
            "", {"project_id": [self.project.id], "end": self.min_ago, "start": self.day_ago}
        )
        assert results == []

    def test_single_project(self):
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "red", "paying": "1"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "blue", "paying": "0"},
            },
            project_id=self.project.id,
        )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("", params)
        assert len(result) == 5
        assert {r.key for r in result} == {"color", "paying", "level"}
        assert {r.value for r in result} == {"red", "blue", "1", "0", "error"}
        assert {r.count for r in result} == {1, 2}

    def test_project_filter(self):
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        other_project = self.create_project()
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"toy": "train"},
            },
            project_id=other_project.id,
        )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("", params)
        keys = {r.key for r in result}
        assert keys == {"color", "level"}

        # Query more than one project.
        params = {
            "project_id": [self.project.id, other_project.id],
            "start": self.day_ago,
            "end": self.min_ago,
        }
        result = discover.get_facets("", params)
        keys = {r.key for r in result}
        assert keys == {"level", "toy", "color", "project"}

        projects = [f for f in result if f.key == "project"]
        assert [p.count for p in projects] == [1, 1]

    def test_enviroment_promoted_tag(self):
        for env in ("prod", "staging", None):
            self.store_event(
                data={
                    "message": "very bad",
                    "type": "default",
                    "environment": env,
                    "timestamp": iso_format(before_now(minutes=2)),
                },
                project_id=self.project.id,
            )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("", params)
        keys = {r.key for r in result}
        assert keys == {"environment", "level"}
        assert {"prod", "staging", None} == {f.value for f in result if f.key == "environment"}
        assert {1} == {f.count for f in result if f.key == "environment"}

    def test_query_string(self):
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "message": "oh my",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"toy": "train"},
            },
            project_id=self.project.id,
        )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("bad", params)
        keys = {r.key for r in result}
        assert "color" in keys
        assert "toy" not in keys

        result = discover.get_facets("color:red", params)
        keys = {r.key for r in result}
        assert "color" in keys
        assert "toy" not in keys

    def test_date_params(self):
        self.store_event(
            data={
                "message": "very bad",
                "type": "default",
                "timestamp": iso_format(before_now(minutes=2)),
                "tags": {"color": "red"},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "message": "oh my",
                "type": "default",
                "timestamp": iso_format(before_now(days=2)),
                "tags": {"toy": "train"},
            },
            project_id=self.project.id,
        )
        params = {"project_id": [self.project.id], "start": self.day_ago, "end": self.min_ago}
        result = discover.get_facets("", params)
        keys = {r.key for r in result}
        assert "color" in keys
        assert "toy" not in keys
