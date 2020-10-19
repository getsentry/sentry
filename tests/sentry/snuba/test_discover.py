from __future__ import absolute_import

import six
import pytest

from sentry.utils.compat.mock import patch
from datetime import datetime, timedelta

from sentry.api.event_search import InvalidSearchQuery
from sentry.snuba import discover
from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils.compat import zip
from sentry.utils.samples import load_data
from sentry.utils.snuba import Dataset


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

    def test_project_mapping(self):
        other_project = self.create_project(organization=self.organization)
        self.store_event(
            data={"message": "hello", "timestamp": iso_format(before_now(minutes=1))},
            project_id=other_project.id,
        )

        result = discover.query(
            selected_columns=["project", "message"],
            query="",
            params={"project_id": [other_project.id]},
            orderby="project",
        )

        data = result["data"]
        assert len(data) == 1
        assert data[0]["project"] == other_project.slug

    def test_sorting_project_name(self):
        project_ids = []
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            project_ids.append(other_project.id)
            self.store_event(
                data={"message": "ohh no", "timestamp": iso_format(before_now(minutes=1))},
                project_id=other_project.id,
            )

        result = discover.query(
            selected_columns=["project", "message"],
            query="",
            params={"project_id": project_ids},
            orderby="project",
        )
        data = result["data"]
        assert len(data) == 3
        assert [item["project"] for item in data] == ["a" * 32, "m" * 32, "z" * 32]

    def test_reverse_sorting_project_name(self):
        project_ids = []
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            project_ids.append(other_project.id)
            self.store_event(
                data={"message": "ohh no", "timestamp": iso_format(before_now(minutes=1))},
                project_id=other_project.id,
            )

        result = discover.query(
            selected_columns=["project", "message"],
            query="",
            params={"project_id": project_ids},
            orderby="-project",
        )
        data = result["data"]
        assert len(data) == 3
        assert [item["project"] for item in data] == ["z" * 32, "m" * 32, "a" * 32]

    def test_using_project_and_project_name(self):
        project_ids = []
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            project_ids.append(other_project.id)
            self.store_event(
                data={"message": "ohh no", "timestamp": iso_format(before_now(minutes=1))},
                project_id=other_project.id,
            )

        result = discover.query(
            selected_columns=["project.name", "message", "project"],
            query="",
            params={"project_id": project_ids},
            orderby="project.name",
        )
        data = result["data"]
        assert len(data) == 3
        assert [item["project.name"] for item in data] == ["a" * 32, "m" * 32, "z" * 32]

    def test_missing_project(self):
        project_ids = []
        for project_name in ["a" * 32, "z" * 32, "m" * 32]:
            other_project = self.create_project(organization=self.organization, slug=project_name)
            project_ids.append(other_project.id)
            self.store_event(
                data={"message": "ohh no", "timestamp": iso_format(before_now(minutes=1))},
                project_id=other_project.id,
            )

        # delete the last project so its missing
        other_project.delete()

        result = discover.query(
            selected_columns=["message", "project"],
            query="",
            params={"project_id": project_ids},
            orderby="project",
        )
        data = result["data"]
        assert len(data) == 3
        assert [item["project"] for item in data] == ["", "a" * 32, "z" * 32]

    def test_field_aliasing_in_selected_columns(self):
        result = discover.query(
            selected_columns=["project.id", "user", "release"],
            query="",
            params={"project_id": [self.project.id]},
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user"] == "id:99"
        assert data[0]["release"] == "first-release"

        assert len(result["meta"]) == 3
        assert result["meta"] == {
            "project.id": "integer",
            "user": "string",
            "release": "string",
        }

    def test_field_alias_with_component(self):
        result = discover.query(
            selected_columns=["project.id", "user", "user.email"],
            query="",
            params={"project_id": [self.project.id]},
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user"] == "id:99"
        assert data[0]["user.email"] == "bruce@example.com"

        assert len(result["meta"]) == 3
        assert result["meta"] == {
            "project.id": "integer",
            "user": "string",
            "user.email": "string",
        }

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
        assert data[0]["project.name"] == self.project.slug

        assert len(result["meta"]) == 5
        assert result["meta"] == {
            "user.email": "string",
            "release": "string",
            "id": "string",
            "project.id": "integer",
            "project.name": "string",
        }

    def test_auto_fields_aggregates(self):
        result = discover.query(
            selected_columns=["count_unique(user.email)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        data = result["data"]
        assert len(data) == 1
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

    def test_latest_release_condition(self):
        result = discover.query(
            selected_columns=["id", "message"],
            query="release:latest",
            params={"project_id": [self.project.id], "organization_id": self.organization.id},
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

    def test_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        self.store_event(
            data={"message": "aaaaa", "timestamp": iso_format(before_now(minutes=1))},
            project_id=project2.id,
        )
        self.store_event(
            data={"message": "bbbbb", "timestamp": iso_format(before_now(minutes=1))},
            project_id=project3.id,
        )

        result = discover.query(
            selected_columns=["project", "message"],
            query="project:{} OR project:{}".format(self.project.slug, project2.slug),
            params={"project_id": [self.project.id, project2.id]},
            orderby="message",
        )

        data = result["data"]
        assert len(data) == 2
        assert data[0]["project"] == project2.slug
        assert data[1]["project"] == self.project.slug

    def test_nested_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        self.store_event(
            data={"release": "a" * 32, "timestamp": iso_format(before_now(minutes=1))},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "b" * 32, "timestamp": iso_format(before_now(minutes=1))},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "c" * 32, "timestamp": iso_format(before_now(minutes=1))},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "a" * 32, "timestamp": iso_format(before_now(minutes=1))},
            project_id=project2.id,
        )

        result = discover.query(
            selected_columns=["release"],
            query="(release:{} OR release:{}) AND project:{}".format(
                "a" * 32, "b" * 32, self.project.slug
            ),
            params={"project_id": [self.project.id, project2.id]},
            orderby="release",
        )

        data = result["data"]
        assert len(data) == 2
        assert data[0]["release"] == "a" * 32
        assert data[1]["release"] == "b" * 32

    def test_conditions_with_special_columns(self):
        for val in ["a", "b", "c"]:
            data = load_data("transaction")
            data["timestamp"] = iso_format(before_now(seconds=1))
            data["transaction"] = val * 32
            data["message"] = val * 32
            data["tags"] = {"sub_customer.is-Enterprise-42": val * 32}
            self.store_event(data=data, project_id=self.project.id)

        result = discover.query(
            selected_columns=["title", "message"],
            query="event.type:transaction (title:{} OR message:{})".format("a" * 32, "b" * 32),
            params={"project_id": [self.project.id]},
            orderby="title",
        )

        data = result["data"]
        assert len(data) == 2
        assert data[0]["title"] == "a" * 32
        assert data[1]["title"] == "b" * 32

        result = discover.query(
            selected_columns=["title", "sub_customer.is-Enterprise-42"],
            query="event.type:transaction (title:{} AND sub_customer.is-Enterprise-42:{})".format(
                "a" * 32, "a" * 32
            ),
            params={"project_id": [self.project.id]},
            orderby="title",
        )

        data = result["data"]
        assert len(data) == 1
        assert data[0]["title"] == "a" * 32
        assert data[0]["sub_customer.is-Enterprise-42"] == "a" * 32

    def test_conditions_with_aggregates(self):
        events = [("a", 2), ("b", 3), ("c", 4)]
        for ev in events:
            val = ev[0] * 32
            for i in range(ev[1]):
                data = load_data("transaction")
                data["timestamp"] = iso_format(before_now(seconds=1))
                data["transaction"] = "{}-{}".format(val, i)
                data["message"] = val
                data["tags"] = {"trek": val}
                self.store_event(data=data, project_id=self.project.id)

        result = discover.query(
            selected_columns=["trek", "count()"],
            query="event.type:transaction (trek:{} OR trek:{}) AND count():>2".format(
                "a" * 32, "b" * 32
            ),
            params={"project_id": [self.project.id]},
            orderby="trek",
            use_aggregate_conditions=True,
        )

        data = result["data"]
        assert len(data) == 1
        assert data[0]["trek"] == "b" * 32
        assert data[0]["count"] == 3

    def test_conditions_with_nested_aggregates(self):
        events = [("a", 2), ("b", 3), ("c", 4)]
        for ev in events:
            val = ev[0] * 32
            for i in range(ev[1]):
                data = load_data("transaction")
                data["timestamp"] = iso_format(before_now(seconds=1))
                data["transaction"] = "{}-{}".format(val, i)
                data["message"] = val
                data["tags"] = {"trek": val}
                self.store_event(data=data, project_id=self.project.id)

        result = discover.query(
            selected_columns=["trek", "count()"],
            query="(event.type:transaction AND (trek:{} AND (transaction:*{}* AND count():>2)))".format(
                "b" * 32, "b" * 32
            ),
            params={"project_id": [self.project.id]},
            orderby="trek",
            use_aggregate_conditions=True,
        )

        data = result["data"]
        assert len(data) == 1
        assert data[0]["trek"] == "b" * 32
        assert data[0]["count"] == 3

        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=["trek", "transaction"],
                query="(event.type:transaction AND (trek:{} AND (transaction:*{}* AND count():>2)))".format(
                    "b" * 32, "b" * 32
                ),
                params={"project_id": [self.project.id]},
                orderby="trek",
                use_aggregate_conditions=True,
            )


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
        assert "No columns selected" in six.text_type(err)
        assert mock_query.call_count == 0

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_field_alias_macro(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "user"}, {"name": "project_id"}],
            "data": [{"user": "a@example.org", "project_id": self.project.id}],
        }
        discover.query(
            selected_columns=["user", "project"], query="", params={"project_id": [self.project.id]}
        )
        mock_query.assert_called_with(
            selected_columns=[
                "user",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [u"'{}'".format(self.project.id)]],
                        ["array", [u"'{}'".format(self.project.slug)]],
                        "''",
                    ],
                    "project",
                ],
            ],
            aggregations=[],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=[],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_project_filter_limits_automatic_fields(self, mock_query):
        project2 = self.create_project(organization=self.organization)
        mock_query.return_value = {
            "meta": [{"name": "title"}, {"name": "project_id"}],
            "data": [{"title": "stuff", "project_id": project2.id}],
        }
        discover.query(
            selected_columns=["title", "project"],
            query="project:{}".format(project2.slug),
            params={"project_id": [self.project.id, project2.id]},
        )
        mock_query.assert_called_with(
            selected_columns=[
                "title",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [u"'{}'".format(project2.id)]],
                        ["array", [u"'{}'".format(project2.slug)]],
                        "''",
                    ],
                    "project",
                ],
            ],
            aggregations=[],
            filter_keys={"project_id": [project2.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[["project_id", "=", project2.id]],
            groupby=[],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_project_with_aggregate_grouping(self, mock_query):
        project2 = self.create_project(organization=self.organization)
        mock_query.return_value = {
            "meta": [{"name": "title"}, {"name": "project_id"}],
            "data": [{"title": "stuff", "project_id": project2.id}],
        }
        discover.query(
            selected_columns=["title", "project", "p99()"],
            query="project:{}".format(project2.slug),
            params={"project_id": [self.project.id, project2.id]},
        )
        mock_query.assert_called_with(
            selected_columns=[
                "title",
                "project_id",
                [
                    "transform",
                    [
                        ["toString", ["project_id"]],
                        ["array", [u"'{}'".format(project2.id)]],
                        ["array", [u"'{}'".format(project2.slug)]],
                        "''",
                    ],
                    "project",
                ],
            ],
            aggregations=[[u"quantile(0.99)", "duration", u"p99"]],
            filter_keys={"project_id": [project2.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[["project_id", "=", project2.id]],
            groupby=["title", "project_id"],
            having=[],
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_no_auto_fields(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "count"}],
            "data": [{"count": 1}],
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
            having=[],
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
            aggregations=[["uniq", "duration", "count_unique_transaction_duration"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            end=None,
            start=None,
            conditions=[],
            groupby=["transaction", "duration"],
            having=[],
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
            selected_columns=["transaction", "p95()", "count_unique(transaction)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                ["quantile(0.95)", "duration", "p95"],
                ["uniq", "transaction", "count_unique_transaction"],
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_failure_rate_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "failure_rate"}],
            "data": [{"transaction": "api.do_things", "failure_rate": 0.314159}],
        }
        discover.query(
            selected_columns=["transaction", "failure_rate()"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["failure_rate()", None, "failure_rate"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_user_misery_alias(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "user_misery_300"}],
            "data": [{"transaction": "api.do_things", "user_misery_300": 15}],
        }
        discover.query(
            selected_columns=["transaction", "user_misery(300)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["uniqIf(user, greater(duration, 1200))", None, "user_misery_300"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_percentile_range_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "firstPercentile"}],
            "data": [{"transaction": "api.do_things", "firstPercentile": 15}],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "percentile_range(transaction.duration, 0.5, 2020-05-02T13:45:01, 2020-05-02T14:45:01, 1)",
            ],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "quantileIf(0.50)",
                    [
                        "duration",
                        [
                            "and",
                            [
                                [
                                    "lessOrEquals",
                                    [["toDateTime", ["'2020-05-02T13:45:01'"]], "timestamp"],
                                ],
                                [
                                    "greater",
                                    [["toDateTime", ["'2020-05-02T14:45:01'"]], "timestamp"],
                                ],
                            ],
                        ],
                    ],
                    "percentile_range_1",
                ]
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_avg_range_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "firstAverage"}],
            "data": [{"transaction": "api.do_things", "firstAverage": 15}],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "avg_range(transaction.duration, 2020-05-02T13:45:01, 2020-05-02T14:45:01, 1)",
            ],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "avgIf",
                    [
                        "duration",
                        [
                            "and",
                            [
                                [
                                    "lessOrEquals",
                                    [["toDateTime", ["'2020-05-02T13:45:01'"]], "timestamp"],
                                ],
                                [
                                    "greater",
                                    [["toDateTime", ["'2020-05-02T14:45:01'"]], "timestamp"],
                                ],
                            ],
                        ],
                    ],
                    "avg_range_1",
                ]
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_selected_columns_user_misery_range_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "firstUserMisery"}],
            "data": [{"transaction": "api.do_things", "firstUserMisery": 15}],
        }
        discover.query(
            selected_columns=[
                "transaction",
                "user_misery_range(300, 2020-05-02T13:45:01, 2020-05-02T14:45:01, 1)",
            ],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[
                [
                    "uniqIf",
                    [
                        "user",
                        [
                            "and",
                            [
                                ["greater", ["duration", 1200]],
                                [
                                    "and",
                                    [
                                        [
                                            "lessOrEquals",
                                            [
                                                ["toDateTime", ["'2020-05-02T13:45:01'"]],
                                                "timestamp",
                                            ],
                                        ],
                                        [
                                            "greater",
                                            [
                                                ["toDateTime", ["'2020-05-02T14:45:01'"]],
                                                "timestamp",
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                    "user_misery_range_1",
                ]
            ],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_percentile_function(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "percentile_transaction_duration_0_75"}],
            "data": [
                {"transaction": "api.do_things", "percentile_transaction_duration_0_75": 1123}
            ],
        }
        discover.query(
            selected_columns=["transaction", "percentile(transaction.duration, 0.75)"],
            query="",
            params={"project_id": [self.project.id]},
            auto_fields=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["quantile(0.75)", "duration", "percentile_transaction_duration_0_75"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[],
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
            having=[],
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
            having=[],
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
            query="transaction.op:ok transaction.duration:200 sdk.name:python tags[projectid]:123",
            params={"project_id": [self.project.id]},
            orderby=["-timestamp", "-count"],
        )
        mock_query.assert_called_with(
            selected_columns=["timestamp", "transaction", "duration"],
            aggregations=[["count", None, "count"]],
            conditions=[
                ["transaction_op", "=", "ok"],
                ["duration", "=", 200],
                ["sdk_name", "=", "python"],
                [["ifNull", ["tags[projectid]", "''"]], "=", "123"],
            ],
            filter_keys={"project_id": [self.project.id]},
            groupby=["timestamp", "transaction", "duration"],
            having=[],
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
                [["match", ["email", "'(?i)^.*@sentry\.io$'"]], "=", 1],
                [["positionCaseInsensitive", ["message", "'recent-searches'"]], "!=", 0],
            ],
            aggregations=[["count", None, "count"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            having=[],
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
            having=[],
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
            having=[],
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
            filter_keys={"project_id": [project2.id]},
            groupby=[],
            dataset=Dataset.Discover,
            aggregations=[],
            having=[],
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
            having=[],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)
        discover.query(
            selected_columns=["transaction", "avg(transaction.duration)"],
            query="http.method:GET avg(transaction.duration):>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[["avg", "duration", "avg_transaction_duration"]],
            having=[["avg_transaction_duration", ">", 5]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_alias_aggregate_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)
        discover.query(
            selected_columns=["transaction", "p95()"],
            query="http.method:GET p95():>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )

        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[["quantile(0.95)", "duration", "p95"]],
            having=[["p95", ">", 5]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_duration_aliases(self, mock_query):
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)
        test_cases = [
            ("1ms", 1),
            ("1.5s", 1500),
            ("23.4m", 1000 * 60 * 23.4),
            ("1.00min", 1000 * 60),
            ("3.45hr", 1000 * 60 * 60 * 3.45),
            ("1.23h", 1000 * 60 * 60 * 1.23),
            ("3wk", 1000 * 60 * 60 * 24 * 7 * 3),
            ("2.1w", 1000 * 60 * 60 * 24 * 7 * 2.1),
        ]
        for query_string, value in test_cases:
            mock_query.return_value = {
                "meta": [{"name": "transaction"}, {"name": "duration"}],
                "data": [{"transaction": "api.do_things", "duration": 200}],
            }
            discover.query(
                selected_columns=["transaction", "p95()"],
                query="http.method:GET p95():>{}".format(query_string),
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
            )

            mock_query.assert_called_with(
                selected_columns=["transaction"],
                conditions=[["http_method", "=", "GET"]],
                filter_keys={"project_id": [self.project.id]},
                groupby=["transaction"],
                dataset=Dataset.Discover,
                aggregations=[["quantile(0.95)", "duration", "p95"]],
                having=[["p95", ">", value]],
                end=end_time,
                start=start_time,
                orderby=None,
                limit=50,
                offset=None,
                referrer=None,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_alias_aggregate_conditions_with_brackets(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)
        discover.query(
            selected_columns=["transaction", "p95()"],
            query="http.method:GET p95():>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )

        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[["quantile(0.95)", "duration", "p95"]],
            having=[["p95", ">", 5]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_date_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)

        discover.query(
            selected_columns=["transaction", "avg(transaction.duration)", "max(time)"],
            query="http.method:GET max(time):>2019-12-01",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["transaction"],
            dataset=Dataset.Discover,
            aggregations=[
                ["avg", "duration", "avg_transaction_duration"],
                ["max", "time", "max_time"],
            ],
            having=[["max_time", ">", 1575158400]],
            end=end_time,
            start=start_time,
            orderby=None,
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_duration_alias(self, mock_query):
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)

        test_cases = [
            ("1ms", 1),
            ("1.5s", 1500),
            ("1.00min", 1000 * 60),
            ("3.45hr", 1000 * 60 * 60 * 3.45),
        ]
        for query_string, value in test_cases:
            mock_query.return_value = {
                "meta": [{"name": "transaction"}, {"name": "duration"}],
                "data": [{"transaction": "api.do_things", "duration": 200}],
            }
            discover.query(
                selected_columns=["transaction", "avg(transaction.duration)", "max(time)"],
                query="http.method:GET avg(transaction.duration):>{}".format(query_string),
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
            )
            mock_query.assert_called_with(
                selected_columns=["transaction"],
                conditions=[["http_method", "=", "GET"]],
                filter_keys={"project_id": [self.project.id]},
                groupby=["transaction"],
                dataset=Dataset.Discover,
                aggregations=[
                    ["avg", "duration", "avg_transaction_duration"],
                    ["max", "time", "max_time"],
                ],
                having=[["avg_transaction_duration", ">", value]],
                end=end_time,
                start=start_time,
                orderby=None,
                limit=50,
                offset=None,
                referrer=None,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_condition_missing_selected_column(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)

        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=["transaction"],
                query="http.method:GET max(time):>5",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_aggregate_condition_missing_with_auto(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)

        with pytest.raises(InvalidSearchQuery):
            discover.query(
                selected_columns=["transaction"],
                query="http.method:GET max(time):>5",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=True,
                auto_aggregations=True,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_no_aggregate_conditions_with_auto(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)

        with pytest.raises(AssertionError):
            discover.query(
                selected_columns=["transaction"],
                query="http.method:GET max(time):>5",
                params={"project_id": [self.project.id], "start": start_time, "end": end_time},
                use_aggregate_conditions=False,
                auto_aggregations=True,
            )

    @patch("sentry.snuba.discover.raw_query")
    def test_auto_aggregation(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)

        discover.query(
            selected_columns=["transaction", "p95()"],
            query="http.method:GET max(time):>5",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
            auto_aggregations=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["quantile(0.95)", "duration", "p95"], ["max", "time", "max_time"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[["http_method", "=", "GET"]],
            start=start_time,
            end=end_time,
            orderby=None,
            having=[["max_time", ">", 5.0]],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_auto_aggregation_with_boolean_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "duration"}],
            "data": [{"transaction": "api.do_things", "duration": 200}],
        }
        start_time = before_now(minutes=10)
        end_time = before_now(seconds=1)

        discover.query(
            selected_columns=["transaction", "min(time)"],
            query="max(time):>5 AND min(time):<10",
            params={"project_id": [self.project.id], "start": start_time, "end": end_time},
            use_aggregate_conditions=True,
            auto_aggregations=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["min", "time", "min_time"], ["max", "time", "max_time"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            start=start_time,
            end=end_time,
            orderby=None,
            having=[["max_time", ">", 5.0], ["min_time", "<", 10.0]],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_function_conditions(self, mock_query):
        mock_query.return_value = {
            "meta": [{"name": "transaction"}, {"name": "percentile_transaction_duration_0_75"}],
            "data": [
                {"transaction": "api.do_things", "percentile_transaction_duration_0_75": 1123}
            ],
        }
        discover.query(
            selected_columns=["transaction", "percentile(transaction.duration, 0.75)"],
            query="percentile(transaction.duration, 0.75):>100",
            params={"project_id": [self.project.id]},
            auto_fields=True,
            use_aggregate_conditions=True,
        )
        mock_query.assert_called_with(
            selected_columns=["transaction"],
            aggregations=[["quantile(0.75)", "duration", "percentile_transaction_duration_0_75"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["transaction"],
            conditions=[],
            end=None,
            start=None,
            orderby=None,
            having=[["percentile_transaction_duration_0_75", ">", 100]],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_translations(self, mock_query):
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 10000, "min_transaction.duration": 0}]},
            {
                "meta": [{"name": "histogram_transaction_duration_10_1000_0"}, {"name": "count"}],
                "data": [{"histogram_transaction_duration_10_1000_0": 1000, "count": 1123}],
            },
        ]
        discover.query(
            selected_columns=["histogram(transaction.duration, 10)", "count()"],
            query="",
            params={"project_id": [self.project.id], "environment": self.environment.name},
            auto_fields=True,
            use_aggregate_conditions=False,
        )
        mock_query.assert_called_with(
            selected_columns=[
                [
                    "multiply",
                    [["floor", [["divide", ["duration", 1000]]]], 1000],
                    "histogram_transaction_duration_10_1000_0",
                ]
            ],
            aggregations=[["count", None, "count"]],
            filter_keys={"project_id": [self.project.id]},
            dataset=Dataset.Discover,
            groupby=["histogram_transaction_duration_10_1000_0"],
            conditions=[[["environment", "=", self.environment.name]]],
            end=None,
            start=None,
            orderby=None,
            having=[],
            limit=50,
            offset=None,
            referrer=None,
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_bad_histogram_translations(self, mock_query):
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 10000, "min_transaction.duration": 0}]},
            {
                "meta": [{"name": "histogram_transaction_duration_10_1000_0"}, {"name": "count"}],
                "data": [{"histogram_transaction_duration_10_1000_0": 1000, "count": 1123}],
            },
        ]
        with pytest.raises(InvalidSearchQuery) as err:
            discover.query(
                selected_columns=["histogram(transaction.duration)", "count()"],
                query="",
                params={"project_id": [self.project.id]},
                auto_fields=True,
                use_aggregate_conditions=False,
            )
        assert "histogram(...) expects 2 column arguments, received 1 arguments" in six.text_type(
            err
        )

        with pytest.raises(InvalidSearchQuery) as err:
            discover.query(
                selected_columns=["histogram(stack.colno, 10)", "count()"],
                query="",
                params={"project_id": [self.project.id]},
                auto_fields=True,
                use_aggregate_conditions=False,
            )
        assert (
            "histogram(...) can only be used with the transaction.duration column"
            in six.text_type(err)
        )

        with pytest.raises(InvalidSearchQuery) as err:
            discover.query(
                selected_columns=["histogram(transaction.duration, 1000)", "count()"],
                query="",
                params={"project_id": [self.project.id]},
                auto_fields=True,
                use_aggregate_conditions=False,
            )
        assert (
            "histogram(...) requires a bucket value between 1 and 500, not 1000"
            in six.text_type(err)
        )

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_zerofill_narrow_range(self, mock_query):
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 505, "min_transaction.duration": 490}]},
            {
                "meta": [{"name": "histogram_transaction_duration_15_1_490"}, {"name": "count"}],
                "data": [
                    {"histogram_transaction_duration_15_1_490": 490, "count": 1},
                    {"histogram_transaction_duration_15_1_490": 492, "count": 2},
                    {"histogram_transaction_duration_15_1_490": 500, "count": 4},
                    {"histogram_transaction_duration_15_1_490": 501, "count": 3},
                ],
            },
        ]
        results = discover.query(
            selected_columns=["histogram(transaction.duration, 15)", "count()"],
            query="",
            params={"project_id": [self.project.id]},
            orderby="histogram_transaction_duration_15",
            auto_fields=True,
            use_aggregate_conditions=False,
        )
        expected = (1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 4, 3, 0, 0, 0, 0)
        for result, exp in zip(results["data"], expected):
            assert result["count"] == exp

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_zerofill_uneven_start_end(self, mock_query):
        # the start end values don't align well with bucket boundaries.
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 507, "min_transaction.duration": 392}]},
            {
                "meta": [{"name": "histogram_transaction_duration_10_12_384"}, {"name": "count"}],
                "data": [
                    {"histogram_transaction_duration_10_12_384": 396, "count": 1},
                    {"histogram_transaction_duration_10_12_384": 420, "count": 2},
                    {"histogram_transaction_duration_10_12_384": 456, "count": 4},
                    {"histogram_transaction_duration_10_12_384": 492, "count": 3},
                ],
            },
        ]
        results = discover.query(
            selected_columns=["histogram(transaction.duration, 10)", "count()"],
            query="",
            params={"project_id": [self.project.id]},
            orderby="histogram_transaction_duration_10",
            auto_fields=True,
            use_aggregate_conditions=False,
        )
        data = results["data"]
        assert len(data) == 10, data
        expected = (0, 1, 0, 2, 0, 0, 4, 0, 0, 3)
        for result, exp in zip(data, expected):
            assert result["count"] == exp

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_zerofill_empty_results(self, mock_query):
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 10000, "min_transaction.duration": 0}]},
            {
                "meta": [{"name": "histogram_transaction_duration_10_1000_0"}, {"name": "count"}],
                "data": [{"histogram_transaction_duration_10_1000_0": 10000, "count": 1}],
            },
        ]

        results = discover.query(
            selected_columns=["histogram(transaction.duration, 10)", "count()"],
            query="",
            params={"project_id": [self.project.id]},
            orderby="histogram_transaction_duration_10",
            auto_fields=True,
            use_aggregate_conditions=False,
        )

        expected = [i * 1000 for i in range(10)]
        for result, exp in zip(results["data"], expected):
            assert result["histogram_transaction_duration_10"] == exp

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_zerofill_full_results(self, mock_query):
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 10000, "min_transaction.duration": 0}]},
            {
                "meta": [{"name": "histogram_transaction_duration_10_1000_0"}, {"name": "count"}],
                "data": [
                    {"histogram_transaction_duration_10_1000_0": i * 1000, "count": i}
                    for i in range(11)
                ],
            },
        ]

        results = discover.query(
            selected_columns=["histogram(transaction.duration, 10)", "count()"],
            query="",
            params={"project_id": [self.project.id]},
            orderby="histogram_transaction_duration_10",
            auto_fields=True,
            use_aggregate_conditions=False,
        )

        expected = [i * 1000 for i in range(11)]
        for result, exp in zip(results["data"], expected):
            assert result["histogram_transaction_duration_10"] == exp
            assert result["count"] == exp / 1000

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_zerofill_missing_results_asc_sort(self, mock_query):
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 10000, "min_transaction.duration": 0}]},
            {
                "meta": [{"name": "histogram_transaction_duration_10_1000_0"}, {"name": "count"}],
                "data": [
                    {"histogram_transaction_duration_10_1000_0": i * 1000, "count": i}
                    for i in range(0, 11, 2)
                ],
            },
        ]

        results = discover.query(
            selected_columns=["histogram(transaction.duration, 10)", "count()"],
            query="",
            params={"project_id": [self.project.id]},
            orderby="histogram_transaction_duration_10",
            auto_fields=True,
            use_aggregate_conditions=False,
        )

        expected = [i * 1000 for i in range(11)]
        for result, exp in zip(results["data"], expected):
            assert result["histogram_transaction_duration_10"] == exp
            assert result["count"] == (exp / 1000 if (exp / 1000) % 2 == 0 else 0)

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_zerofill_missing_results_desc_sort(self, mock_query):
        seed = list(range(0, 11, 2))
        seed.reverse()
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 10000, "min_transaction.duration": 0}]},
            {
                "meta": [{"name": "histogram_transaction_duration_10_1000_0"}, {"name": "count"}],
                "data": [
                    {"histogram_transaction_duration_10_1000_0": i * 1000, "count": i} for i in seed
                ],
            },
        ]

        results = discover.query(
            selected_columns=["histogram(transaction.duration, 10)", "count()"],
            query="",
            params={"project_id": [self.project.id]},
            orderby="-histogram_transaction_duration_10",
            auto_fields=True,
            use_aggregate_conditions=False,
        )

        expected = [i * 1000 for i in range(11)]
        expected.reverse()
        for result, exp in zip(results["data"], expected):
            assert result["histogram_transaction_duration_10"] == exp
            assert result["count"] == (exp / 1000 if (exp / 1000) % 2 == 0 else 0)

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_zerofill_missing_results_no_sort(self, mock_query):
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 10000, "min_transaction.duration": 0}]},
            {
                "meta": [{"name": "histogram_transaction_duration_10_1000_0"}, {"name": "count"}],
                "data": [
                    {"histogram_transaction_duration_10_1000_0": i * 1000, "count": i}
                    for i in range(0, 10, 2)
                ],
            },
        ]

        results = discover.query(
            selected_columns=["histogram(transaction.duration, 10)", "count()"],
            query="",
            params={"project_id": [self.project.id]},
            orderby="count",
            auto_fields=True,
            use_aggregate_conditions=False,
        )

        expected = [0, 2000, 4000, 6000, 8000]
        for result, exp in zip(results["data"], expected):
            assert result["histogram_transaction_duration_10"] == exp
            assert result["count"] == exp / 1000

        expected_extra_buckets = set([1000, 3000, 5000, 7000, 9000])
        extra_buckets = set(r["histogram_transaction_duration_10"] for r in results["data"][5:])
        assert expected_extra_buckets == extra_buckets

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_zerofill_on_weird_bucket(self, mock_query):
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 869, "min_transaction.duration": 0}]},
            {
                "meta": [{"name": "histogram_transaction_duration_10_87_0"}, {"name": "count"}],
                "data": [
                    {"histogram_transaction_duration_10_87_0": i * 87, "count": i}
                    for i in range(1, 10, 2)
                ],
            },
        ]

        results = discover.query(
            selected_columns=["histogram(transaction.duration, 10)", "count()"],
            query="",
            params={"project_id": [self.project.id]},
            orderby="histogram_transaction_duration_10",
            auto_fields=True,
            use_aggregate_conditions=False,
        )

        expected = [i * 87 for i in range(11)]
        for result, exp in zip(results["data"], expected):
            assert result["histogram_transaction_duration_10"] == exp
            assert result["count"] == (exp / 87 if (exp / 87) % 2 == 1 else 0)

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_min_equal_max(self, mock_query):
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 869, "min_transaction.duration": 869}]},
            {
                "meta": [{"name": "histogram_transaction_duration_10_1_869"}, {"name": "count"}],
                "data": [{"histogram_transaction_duration_10_1_869": 869, "count": 1}],
            },
        ]

        results = discover.query(
            selected_columns=["histogram(transaction.duration, 10)", "count()"],
            query="",
            params={"project_id": [self.project.id]},
            orderby="histogram_transaction_duration_10",
            auto_fields=True,
            use_aggregate_conditions=False,
        )

        assert results["data"][0]["histogram_transaction_duration_10"] == 869
        assert results["data"][0]["count"] == 1

    @patch("sentry.snuba.discover.raw_query")
    def test_histogram_enormous_max(self, mock_query):
        mock_query.side_effect = [
            {"data": [{"max_transaction.duration": 64733000000, "min_transaction.duration": 1}]},
            {
                "meta": [
                    {"name": "histogram_transaction_duration_10_6473300000_0"},
                    {"name": "count"},
                ],
                "data": [
                    {"histogram_transaction_duration_10_6473300000_0": 64733000000, "count": 1}
                ],
            },
        ]

        results = discover.query(
            selected_columns=["histogram(transaction.duration, 10)", "count()"],
            query="",
            params={"project_id": [self.project.id]},
            orderby="histogram_transaction_duration_10",
            auto_fields=True,
            use_aggregate_conditions=False,
        )

        assert len(results["data"]) == 11
        assert results["data"][-1]["histogram_transaction_duration_10"] == 64733000000
        assert results["data"][-1]["count"] == 1

    @patch("sentry.snuba.discover.raw_query")
    def test_measurements_histogram_min_max(self, mock_query):
        # no rows returned from snuba
        mock_query.side_effect = [{"meta": [], "data": []}]
        values = discover.find_measurements_min_max(
            ["foo"], None, None, "", {"project_id": [self.project.id]}
        )
        assert values == (None, None)

        # more than 2 rows returned snuba
        mock_query.side_effect = [{"meta": [], "data": [{}, {}]}]
        values = discover.find_measurements_min_max(
            ["foo"], None, None, "", {"project_id": [self.project.id]}
        )
        assert values == (None, None)

        # None rows are returned from snuba
        mock_query.side_effect = [
            {
                "meta": [{"name": "min_measurements_foo"}, {"name": "max_measurements_foo"}],
                "data": [{"min_measurements_foo": None, "max_measurements_foo": None}],
            },
        ]
        values = discover.find_measurements_min_max(
            ["foo"], None, None, "", {"project_id": [self.project.id]}
        )
        assert values == (None, None)

        # use the given min/max
        values = discover.find_measurements_min_max(
            ["foo"], 1, 2, "", {"project_id": [self.project.id]}
        )
        assert values == (1, 2)

        # use the given min, but query for max
        mock_query.side_effect = [
            {"meta": [{"name": "max_measurements_foo"}], "data": [{"max_measurements_foo": 3.45}]},
        ]
        values = discover.find_measurements_min_max(
            ["foo"], 1.23, None, "", {"project_id": [self.project.id]}
        )
        assert values == (1.23, 3.45)

        # use the given max, but query for min
        mock_query.side_effect = [
            {"meta": [{"name": "min_measurements_foo"}], "data": [{"min_measurements_foo": 1.23}]},
        ]
        values = discover.find_measurements_min_max(
            ["foo"], None, 3.45, "", {"project_id": [self.project.id]}
        )
        assert values == (1.23, 3.45)

        # single min/max returned from snuba
        mock_query.side_effect = [
            {
                "meta": [{"name": "min_measurements_foo"}, {"name": "max_measurements_foo"}],
                "data": [{"min_measurements_foo": 1.23, "max_measurements_foo": 3.45}],
            },
        ]
        values = discover.find_measurements_min_max(
            ["foo"], None, None, "", {"project_id": [self.project.id]}
        )
        assert values == (1.23, 3.45)

        # multiple min/max returned from snuba
        mock_query.side_effect = [
            {
                "meta": [
                    {"name": "min_measurements_foo"},
                    {"name": "min_measurements_bar"},
                    {"name": "min_measurements_baz"},
                    {"name": "max_measurements_foo"},
                    {"name": "max_measurements_bar"},
                    {"name": "max_measurements_baz"},
                ],
                "data": [
                    {
                        "min_measurements_foo": 1.23,
                        "min_measurements_bar": 1.34,
                        "min_measurements_baz": 1.45,
                        "max_measurements_foo": 3.45,
                        "max_measurements_bar": 3.56,
                        "max_measurements_baz": 3.67,
                    }
                ],
            },
        ]
        values = discover.find_measurements_min_max(
            ["foo", "bar", "baz"], None, None, "", {"project_id": [self.project.id]}
        )
        assert values == (1.23, 3.67)

        # multiple min/max with some Nones returned from snuba
        mock_query.side_effect = [
            {
                "meta": [
                    {"name": "min_measurements_foo"},
                    {"name": "min_measurements_bar"},
                    {"name": "min_measurements_baz"},
                    {"name": "max_measurements_foo"},
                    {"name": "max_measurements_bar"},
                    {"name": "max_measurements_baz"},
                ],
                "data": [
                    {
                        "min_measurements_foo": 1.23,
                        "min_measurements_bar": None,
                        "min_measurements_baz": 1.45,
                        "max_measurements_foo": 3.45,
                        "max_measurements_bar": None,
                        "max_measurements_baz": 3.67,
                    }
                ],
            },
        ]
        values = discover.find_measurements_min_max(
            ["foo", "bar", "baz"], None, None, "", {"project_id": [self.project.id]}
        )
        assert values == (1.23, 3.67)

    def test_measurements_histogram_params(self):
        # min and max is None
        assert discover.find_measurements_histogram_params(1, None, None, 1) == (1, 0, 1)
        # min is None
        assert discover.find_measurements_histogram_params(1, None, 1, 10) == (1, 0, 10)
        # max is None
        assert discover.find_measurements_histogram_params(1, 1, None, 100) == (1, 0, 100)

        assert discover.find_measurements_histogram_params(10, 0, 9, 1) == (1, 0, 1)
        assert discover.find_measurements_histogram_params(10, 0, 10, 1) == (2, 0, 1)
        assert discover.find_measurements_histogram_params(10, 0, 99, 1) == (10, 0, 1)
        assert discover.find_measurements_histogram_params(10, 0, 100, 1) == (11, 0, 1)
        assert discover.find_measurements_histogram_params(5, 10, 19, 10) == (19, 100, 10)
        assert discover.find_measurements_histogram_params(5, 10, 19.9, 10) == (20, 100, 10)
        assert discover.find_measurements_histogram_params(10, 10, 20, 1) == (2, 10, 1)
        assert discover.find_measurements_histogram_params(10, 10, 20, 10) == (11, 100, 10)
        assert discover.find_measurements_histogram_params(10, 10, 20, 100) == (101, 1000, 100)

    def test_measurements_histogram_normalization_meta(self):
        results = {
            "meta": {
                "array_join_measurements_key": "string",
                "measurements_histogram_1_0_1": "number",
                "count": "integer",
            },
            "data": [],
        }
        normalized_results = discover.normalize_measurements_histogram(
            ["foo"], 3, "array_join(measurements_key)", discover.HistogramParams(1, 0, 1), results,
        )
        assert normalized_results["meta"] == {
            "key": "string",
            "bin": "number",
            "count": "integer",
        }

    def test_measurements_histogram_normalization_empty(self):
        results = {
            "meta": {
                "array_join_measurements_key": "string",
                "measurements_histogram_1_0_1": "number",
                "count": "integer",
            },
            "data": [],
        }
        normalized_results = discover.normalize_measurements_histogram(
            ["foo"], 3, "array_join(measurements_key)", discover.HistogramParams(1, 0, 1), results,
        )
        assert normalized_results["data"] == [
            {"key": "foo", "bin": 0, "count": 0},
            {"key": "foo", "bin": 1, "count": 0},
            {"key": "foo", "bin": 2, "count": 0},
        ]

    def test_measurements_histogram_normalization_empty_multiple(self):
        results = {
            "meta": {
                "array_join_measurements_key": "string",
                "measurements_histogram_1_0_1": "number",
                "count": "integer",
            },
            "data": [],
        }
        normalized_results = discover.normalize_measurements_histogram(
            ["bar", "foo"],
            3,
            "array_join(measurements_key)",
            discover.HistogramParams(1, 0, 1),
            results,
        )
        assert normalized_results["data"] == [
            {"key": "bar", "bin": 0, "count": 0},
            {"key": "foo", "bin": 0, "count": 0},
            {"key": "bar", "bin": 1, "count": 0},
            {"key": "foo", "bin": 1, "count": 0},
            {"key": "bar", "bin": 2, "count": 0},
            {"key": "foo", "bin": 2, "count": 0},
        ]

    def test_measurements_histogram_normalization_full(self):
        results = {
            "meta": {
                "array_join_measurements_key": "string",
                "measurements_histogram_1_0_1": "number",
                "count": "integer",
            },
            "data": [
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_1_0_1": 0,
                    "count": 3,
                },
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_1_0_1": 1,
                    "count": 2,
                },
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_1_0_1": 2,
                    "count": 1,
                },
            ],
        }
        normalized_results = discover.normalize_measurements_histogram(
            ["foo"], 3, "array_join(measurements_key)", discover.HistogramParams(1, 0, 1), results,
        )
        assert normalized_results["data"] == [
            {"key": "foo", "bin": 0, "count": 3},
            {"key": "foo", "bin": 1, "count": 2},
            {"key": "foo", "bin": 2, "count": 1},
        ]

    def test_measurements_histogram_normalization_full_multiple(self):
        results = {
            "meta": {
                "array_join_measurements_key": "string",
                "measurements_histogram_1_0_1": "number",
                "count": "integer",
            },
            "data": [
                {
                    "array_join_measurements_key": "bar",
                    "measurements_histogram_1_0_1": 0,
                    "count": 1,
                },
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_1_0_1": 0,
                    "count": 3,
                },
                {
                    "array_join_measurements_key": "bar",
                    "measurements_histogram_1_0_1": 1,
                    "count": 2,
                },
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_1_0_1": 1,
                    "count": 2,
                },
                {
                    "array_join_measurements_key": "bar",
                    "measurements_histogram_1_0_1": 2,
                    "count": 3,
                },
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_1_0_1": 2,
                    "count": 1,
                },
            ],
        }
        normalized_results = discover.normalize_measurements_histogram(
            ["bar", "foo"],
            3,
            "array_join(measurements_key)",
            discover.HistogramParams(1, 0, 1),
            results,
        )
        assert normalized_results["data"] == [
            {"key": "bar", "bin": 0, "count": 1},
            {"key": "foo", "bin": 0, "count": 3},
            {"key": "bar", "bin": 1, "count": 2},
            {"key": "foo", "bin": 1, "count": 2},
            {"key": "bar", "bin": 2, "count": 3},
            {"key": "foo", "bin": 2, "count": 1},
        ]

    def test_measurements_histogram_normalization_partial(self):
        results = {
            "meta": {
                "array_join_measurements_key": "string",
                "measurements_histogram_1_0_1": "number",
                "count": "integer",
            },
            "data": [
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_1_0_1": 0,
                    "count": 3,
                },
            ],
        }
        normalized_results = discover.normalize_measurements_histogram(
            ["foo"], 3, "array_join(measurements_key)", discover.HistogramParams(1, 0, 1), results,
        )
        assert normalized_results["data"] == [
            {"key": "foo", "bin": 0, "count": 3},
            {"key": "foo", "bin": 1, "count": 0},
            {"key": "foo", "bin": 2, "count": 0},
        ]

    def test_measurements_histogram_normalization_partial_multiple(self):
        results = {
            "meta": {
                "array_join_measurements_key": "string",
                "measurements_histogram_1_0_1": "number",
                "count": "integer",
            },
            "data": [
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_1_0_1": 0,
                    "count": 3,
                },
                {
                    "array_join_measurements_key": "bar",
                    "measurements_histogram_1_0_1": 2,
                    "count": 3,
                },
            ],
        }
        normalized_results = discover.normalize_measurements_histogram(
            ["bar", "foo"],
            3,
            "array_join(measurements_key)",
            discover.HistogramParams(1, 0, 1),
            results,
        )
        assert normalized_results["data"] == [
            {"key": "bar", "bin": 0, "count": 0},
            {"key": "foo", "bin": 0, "count": 3},
            {"key": "bar", "bin": 1, "count": 0},
            {"key": "foo", "bin": 1, "count": 0},
            {"key": "bar", "bin": 2, "count": 3},
            {"key": "foo", "bin": 2, "count": 0},
        ]

    def test_measurements_histogram_normalization_ignore_unexpected_rows(self):
        results = {
            "meta": {
                "array_join_measurements_key": "string",
                "measurements_histogram_1_0_1": "number",
                "count": "integer",
            },
            "data": [
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_1_0_1": 0,
                    "count": 3,
                },
                # this row shouldn't be used because "baz" isn't an expected measurement
                {
                    "array_join_measurements_key": "baz",
                    "measurements_histogram_1_0_1": 1,
                    "count": 3,
                },
                {
                    "array_join_measurements_key": "bar",
                    "measurements_histogram_1_0_1": 2,
                    "count": 3,
                },
                # this row shouldn't be used because 3 isn't an expected bin
                {
                    "array_join_measurements_key": "bar",
                    "measurements_histogram_1_0_1": 3,
                    "count": 3,
                },
            ],
        }
        normalized_results = discover.normalize_measurements_histogram(
            ["bar", "foo"],
            3,
            "array_join(measurements_key)",
            discover.HistogramParams(1, 0, 1),
            results,
        )
        assert normalized_results["data"] == [
            {"key": "bar", "bin": 0, "count": 0},
            {"key": "foo", "bin": 0, "count": 3},
            {"key": "bar", "bin": 1, "count": 0},
            {"key": "foo", "bin": 1, "count": 0},
            {"key": "bar", "bin": 2, "count": 3},
            {"key": "foo", "bin": 2, "count": 0},
        ]

    def test_measurements_histogram_normalization_adjust_for_precision(self):
        results = {
            "meta": {
                "array_join_measurements_key": "string",
                "measurements_histogram_25_0_100": "number",
                "count": "integer",
            },
            "data": [
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_25_0_100": 0,
                    "count": 3,
                },
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_25_0_100": 25,
                    "count": 2,
                },
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_25_0_100": 50,
                    "count": 1,
                },
                {
                    "array_join_measurements_key": "foo",
                    "measurements_histogram_25_0_100": 75,
                    "count": 1,
                },
            ],
        }
        normalized_results = discover.normalize_measurements_histogram(
            ["foo"],
            4,
            "array_join(measurements_key)",
            discover.HistogramParams(25, 0, 100),
            results,
        )
        assert normalized_results["data"] == [
            {"key": "foo", "bin": 0, "count": 3},
            {"key": "foo", "bin": 0.25, "count": 2},
            {"key": "foo", "bin": 0.50, "count": 1},
            {"key": "foo", "bin": 0.75, "count": 1},
        ]

    @patch("sentry.snuba.discover.raw_query")
    def test_measurements_histogram(self, mock_query):
        mock_query.side_effect = [
            {
                "meta": [{"name": "min_measurements_foo"}, {"name": "max_measurements_foo"}],
                "data": [
                    {
                        "min_measurements_bar": 2,
                        "min_measurements_foo": 0,
                        "max_measurements_bar": 2,
                        "max_measurements_foo": 2,
                    }
                ],
            },
            {
                "meta": [
                    {"name": "array_join_measurements_key", "type": "String"},
                    {"name": "measurements_histogram_1_0_1", "type": "Float64"},
                    {"name": "count", "type": "UInt64"},
                ],
                "data": [
                    {
                        "array_join_measurements_key": "bar",
                        "measurements_histogram_1_0_1": 0,
                        "count": 3,
                    },
                    {
                        "array_join_measurements_key": "foo",
                        "measurements_histogram_1_0_1": 0,
                        "count": 3,
                    },
                    {
                        "array_join_measurements_key": "foo",
                        "measurements_histogram_1_0_1": 2,
                        "count": 1,
                    },
                ],
            },
        ]
        results = discover.measurements_histogram_query(
            ["bar", "foo"], "", {"project_id": [self.project.id]}, 3, 0
        )
        assert results["data"] == [
            {"key": "bar", "bin": 0, "count": 3},
            {"key": "foo", "bin": 0, "count": 3},
            {"key": "bar", "bin": 1, "count": 0},
            {"key": "foo", "bin": 1, "count": 0},
            {"key": "bar", "bin": 2, "count": 0},
            {"key": "foo", "bin": 2, "count": 1},
        ]

    @patch("sentry.snuba.discover.raw_query")
    def test_measurements_histogram_with_optionals(self, mock_query):
        mock_query.side_effect = [
            {
                "meta": [
                    {"name": "array_join_measurements_key", "type": "String"},
                    {"name": "measurements_histogram_5_5_10", "type": "Float64"},
                    {"name": "count", "type": "UInt64"},
                ],
                "data": [
                    # this row shouldn't be used because it lies outside the boundary
                    {
                        "array_join_measurements_key": "foo",
                        "measurements_histogram_5_5_10": 0,
                        "count": 1,
                    },
                    {
                        "array_join_measurements_key": "foo",
                        "measurements_histogram_5_5_10": 5,
                        "count": 3,
                    },
                    {
                        "array_join_measurements_key": "bar",
                        "measurements_histogram_5_5_10": 10,
                        "count": 2,
                    },
                    {
                        "array_join_measurements_key": "foo",
                        "measurements_histogram_5_5_10": 15,
                        "count": 1,
                    },
                    # this row shouldn't be used because it lies outside the boundary
                    {
                        "array_join_measurements_key": "bar",
                        "measurements_histogram_5_5_10": 30,
                        "count": 2,
                    },
                ],
            },
        ]
        results = discover.measurements_histogram_query(
            ["bar", "foo"], "", {"project_id": [self.project.id]}, 3, 1, 0.5, 2
        )
        assert results["data"] == [
            {"key": "bar", "bin": 0.5, "count": 0},
            {"key": "foo", "bin": 0.5, "count": 3},
            {"key": "bar", "bin": 1.0, "count": 2},
            {"key": "foo", "bin": 1.0, "count": 0},
            {"key": "bar", "bin": 1.5, "count": 0},
            {"key": "foo", "bin": 1.5, "count": 1},
        ]


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
            selected_columns=["p95()"],
            query="event.type:transaction transaction:api.issue.delete",
            params={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "project_id": [self.project.id],
            },
            rollup=3600,
        )
        assert len(result.data["data"]) == 3

    def test_failure_rate_field_alias(self):
        result = discover.timeseries_query(
            selected_columns=["failure_rate()"],
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

    def test_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        project3 = self.create_project(organization=self.organization)

        self.store_event(
            data={"message": "hello", "timestamp": iso_format(before_now(minutes=1))},
            project_id=project2.id,
        )
        self.store_event(
            data={"message": "hello", "timestamp": iso_format(before_now(minutes=1))},
            project_id=project3.id,
        )

        result = discover.timeseries_query(
            selected_columns=["count()"],
            query="project:{} OR project:{}".format(self.project.slug, project2.slug),
            params={
                "start": before_now(minutes=5),
                "end": before_now(seconds=1),
                "project_id": [self.project.id, project2.id, project3.id],
            },
            rollup=3600,
        )

        data = result.data["data"]
        assert len([d for d in data if "count" in d]) == 1
        for d in data:
            if "count" in d:
                assert d["count"] == 1

    def test_nested_conditional_filter(self):
        project2 = self.create_project(organization=self.organization)
        self.store_event(
            data={"release": "a" * 32, "timestamp": iso_format(before_now(minutes=1))},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "b" * 32, "timestamp": iso_format(before_now(minutes=1))},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "c" * 32, "timestamp": iso_format(before_now(minutes=1))},
            project_id=self.project.id,
        )
        self.event = self.store_event(
            data={"release": "a" * 32, "timestamp": iso_format(before_now(minutes=1))},
            project_id=project2.id,
        )

        result = discover.timeseries_query(
            selected_columns=["release", "count()"],
            query="(release:{} OR release:{}) AND project:{}".format(
                "a" * 32, "b" * 32, self.project.slug
            ),
            params={
                "start": before_now(minutes=5),
                "end": before_now(seconds=1),
                "project_id": [self.project.id, project2.id],
            },
            rollup=3600,
        )

        data = result.data["data"]
        data = result.data["data"]
        assert len([d for d in data if "count" in d]) == 1
        for d in data:
            if "count" in d:
                assert d["count"] == 2


def format_project_event(project_slug, event_id):
    return "{}:{}".format(project_slug, event_id)


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

    def test_environment_promoted_tag(self):
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
        assert {None, "prod", "staging"} == {f.value for f in result if f.key == "environment"}
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

    def test_query_string_with_aggregate_condition(self):
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

        result = discover.get_facets("color:red p95():>1", params)
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


def test_zerofill():
    results = discover.zerofill(
        {}, datetime(2019, 1, 2, 0, 0), datetime(2019, 1, 9, 23, 59, 59), 86400, "time"
    )
    results_desc = discover.zerofill(
        {}, datetime(2019, 1, 2, 0, 0), datetime(2019, 1, 9, 23, 59, 59), 86400, "-time"
    )

    assert results == list(reversed(results_desc))

    # Bucket for the 2, 3, 4, 5, 6, 7, 8, 9
    assert len(results) == 8

    assert results[0]["time"] == 1546387200
    assert results[7]["time"] == 1546992000
