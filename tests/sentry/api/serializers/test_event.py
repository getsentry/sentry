from datetime import UTC, datetime
from unittest import mock

from sentry.api.serializers import SimpleEventSerializer, serialize
from sentry.api.serializers.models.event import (
    IssueEventSerializer,
    SharedEventSerializer,
    SqlFormatEventSerializer,
)
from sentry.api.serializers.rest_framework import convert_dict_key_case, snake_to_camel_case
from sentry.models.eventerror import EventError
from sentry.models.release import Release
from sentry.sdk_updates import SdkIndexState
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = [requires_snuba]


class EventSerializerTest(TestCase, OccurrenceTestMixin):
    def test_simple(self):
        event_id = "a" * 32
        event = self.store_event(
            data={"event_id": event_id, "timestamp": before_now(minutes=1).isoformat()},
            project_id=self.project.id,
        )
        result = serialize(event)
        assert result["id"] == event_id
        assert result["eventID"] == event_id
        assert result["occurrence"] is None

    def test_eventerror(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "stacktrace": ["ü"],
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event)
        assert len(result["errors"]) == 1
        assert "data" in result["errors"][0]
        assert result["errors"][0]["type"] == EventError.INVALID_DATA
        assert result["errors"][0]["data"] == {
            "name": "stacktrace",
            "reason": "expected rawstacktrace",
            "value": ["\xfc"],
        }
        assert "startTimestamp" not in result
        assert "timestamp" not in result

    def test_hidden_eventerror(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "breadcrumbs": ["ü"],
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event)
        assert result["errors"] == []

    def test_renamed_attributes(self):
        # Only includes meta for simple top-level attributes
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "extra": {"extra": True},
                "modules": {"modules": "foobar"},
                "_meta": {
                    "extra": {"": {"err": ["extra error"]}},
                    "modules": {"": {"err": ["modules error"]}},
                },
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event)
        assert result["context"] == {"extra": True}
        assert result["_meta"]["context"] == {"": {"err": ["extra error"]}}
        assert result["packages"] == {"modules": "foobar"}
        assert result["_meta"]["packages"] == {"": {"err": ["modules error"]}}

    def test_message_interface(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "logentry": {"formatted": "bar"},
                "_meta": {"logentry": {"formatted": {"": {"err": ["some error"]}}}},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event)
        assert result["message"] == "bar"
        assert result["_meta"]["message"] == {"": {"err": ["some error"]}}

    def test_message_formatted(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "logentry": {"formatted": "baz"},
                "_meta": {"logentry": {"formatted": {"": {"err": ["some error"]}}}},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event)
        assert result["message"] == "baz"
        assert result["_meta"]["message"] == {"": {"err": ["some error"]}}

    def test_exception_interface(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "exception": {
                    "values": [
                        {
                            "type": "ValidationError",
                            "value": "Bad request",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "filename": "foo.py",
                                        "lineno": 100,
                                        "in_app": True,
                                        "vars": {"foo": "[Filtered]"},
                                    }
                                ]
                            },
                        }
                    ]
                },
                "_meta": {
                    "exception": {
                        "values": {
                            "0": {
                                "stacktrace": {
                                    "frames": {
                                        "0": {
                                            "lineno": 100,
                                            "in_app": True,
                                            "vars": {"foo": {"": {"err": ["some error"]}}},
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event)

        assert result["entries"][0]["type"] == "exception"

        # Exception interface data should be preserved
        assert (
            result["entries"][0]["data"]["values"][0]["stacktrace"]["frames"][0]["vars"]["foo"]
            == "[Filtered]"
        )
        # Exception meta should be preserved
        assert result["_meta"]["entries"][0]["data"]["values"]["0"]["stacktrace"]["frames"]["0"][
            "vars"
        ]["foo"] == {"": {"err": ["some error"]}}

    def test_tags_tuples(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "level": "error",  # creates a derived tag.
                "timestamp": before_now(minutes=1).isoformat(),
                "tags": [["foo", "foo"], ["bar", "bar"], ["last", "tag"], None],
                "_meta": {
                    "tags": {
                        "0": {"1": {"": {"err": ["foo error"]}}},
                        "1": {"0": {"": {"err": ["bar error"]}}},
                        "3": {"": {"err": ["full error"]}},
                    }
                },
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event)
        # Expect 3 custom tags + derived "level". The ``None``` entry is removed
        # by the serializer as it cannot be rendered. Such entries are generated
        # by Relay normalization.
        assert len(result["tags"]) == 4
        assert result["tags"][0]["value"] == "bar"
        assert result["tags"][1]["value"] == "foo"
        assert result["_meta"]["tags"]["0"]["key"] == {"": {"err": ["bar error"]}}
        assert result["_meta"]["tags"]["1"]["value"] == {"": {"err": ["foo error"]}}
        assert result["_meta"]["tags"].get("2") is None

    def test_tags_dict(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "tags": {"foo": "foo", "bar": "bar", "last": "tag"},
                "_meta": {
                    "tags": {
                        "foo": {"": {"err": ["foo error"]}},
                        "bar": {"": {"err": ["bar error"]}},
                    }
                },
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event)
        assert result["tags"][0]["value"] == "bar"
        assert result["tags"][1]["value"] == "foo"
        assert result["_meta"]["tags"]["0"]["value"] == {"": {"err": ["bar error"]}}
        assert result["_meta"]["tags"]["1"]["value"] == {"": {"err": ["foo error"]}}
        assert result["_meta"]["tags"].get("2") is None

    def test_none_interfaces(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "breadcrumbs": None,
                "exception": None,
                "logentry": None,
                "request": None,
                "user": None,
                "contexts": None,
                "sdk": None,
                "_meta": None,
            },
            project_id=self.project.id,
        )

        result = serialize(event)
        assert not any(e["type"] == "breadcrumbs" for e in result["entries"])
        assert not any(e["type"] == "exception" for e in result["entries"])
        assert not any(e["type"] == "message" for e in result["entries"])
        assert not any(e["type"] == "request" for e in result["entries"])
        assert result["user"] is None
        assert result["sdk"] is None
        assert result["contexts"] == {}
        assert "startTimestamp" not in result

    def test_transaction_event(self):
        event_data = load_data("transaction")
        event = self.store_event(data=event_data, project_id=self.project.id)
        result = serialize(event)
        assert isinstance(result["endTimestamp"], float)
        assert result["endTimestamp"] == event.data.get("timestamp")
        assert isinstance(result["startTimestamp"], float)
        assert result["startTimestamp"] == event.data.get("start_timestamp")
        assert "dateCreated" not in result
        assert "crashFile" not in result
        assert "fingerprints" not in result
        assert "measurements" in result
        assert result["measurements"] == event_data["measurements"]
        assert "breakdowns" in result
        assert result["breakdowns"] == event_data["breakdowns"]

    def test_transaction_event_empty_spans(self):
        event_data = load_data("transaction")
        event_data["spans"] = []
        event = self.store_event(data=event_data, project_id=self.project.id)
        result = serialize(event)
        assert result["entries"][0]["type"] == "spans"

    def test_event_with_occurrence(self):
        event = self.store_event(
            data={},
            project_id=self.project.id,
        )
        assert event.group is not None
        event_group = event.for_group(event.group)
        event_group.occurrence = occurrence = self.build_occurrence()
        result = serialize(event_group)
        assert result["occurrence"] == convert_dict_key_case(
            occurrence.to_dict(), snake_to_camel_case
        )


class SharedEventSerializerTest(TestCase):
    def test_simple(self):
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": before_now(minutes=1).isoformat()},
            project_id=self.project.id,
        )

        result = serialize(event, None, SharedEventSerializer())
        assert result["id"] == "a" * 32
        assert result["eventID"] == "a" * 32
        assert result.get("context") is None
        assert result.get("contexts") is None
        assert result.get("user") is None
        assert result.get("tags") is None
        assert "sdk" not in result
        assert "errors" not in result
        for entry in result["entries"]:
            assert entry["type"] != "breadcrumbs"


class SimpleEventSerializerTest(TestCase):
    def test_user(self):
        """
        Use the SimpleEventSerializer to serialize an event
        """
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "user": {"email": "test@test.com"},
            },
            project_id=self.project.id,
        )
        assert event.group is not None
        result = serialize(event, None, SimpleEventSerializer())

        assert result["eventID"] == event.event_id
        assert result["projectID"] == str(event.project_id)
        assert result["groupID"] == str(event.group.id)
        assert result["message"] == event.message
        assert result["title"] == event.title
        assert result["location"] == event.location
        assert result["culprit"] == event.culprit
        assert result["dateCreated"] == event.datetime
        assert result["user"]["id"] == event.get_minimal_user().id
        assert result["user"]["email"] == event.get_minimal_user().email
        assert result["user"]["username"] == event.get_minimal_user().username
        assert result["user"]["ip_address"] == event.get_minimal_user().ip_address
        assert result["tags"] == [
            {"key": "level", "value": "error"},
            {"key": "user", "value": "email:test@test.com", "query": 'user.email:"test@test.com"'},
        ]

    def test_no_group(self):
        """
        Use the SimpleEventSerializer to serialize an event without group
        """
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "start_timestamp": before_now(minutes=1, seconds=5).isoformat(),
                "timestamp": before_now(minutes=1).isoformat(),
                "user": {"email": "test@test.com"},
                "type": "transaction",
                "transaction": "api.issue.delete",
                "spans": [],
                "contexts": {"trace": {"op": "foobar", "trace_id": "a" * 32, "span_id": "a" * 16}},
            },
            project_id=self.project.id,
        )

        result = serialize(event, None, SimpleEventSerializer())
        assert result["groupID"] is None


class IssueEventSerializerTest(TestCase):
    @mock.patch(
        "sentry.sdk_updates.SdkIndexState",
        return_value=SdkIndexState(sdk_versions={"example.sdk": "2.0.0"}),
    )
    def test_update_on_major(self, mock_index_state):
        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event, None, IssueEventSerializer())
        assert result["sdkUpdates"] == [
            {
                "enables": [],
                "newSdkVersion": "2.0.0",
                "sdkName": "example.sdk",
                "sdkUrl": None,
                "type": "updateSdk",
            }
        ]

    @mock.patch(
        "sentry.sdk_updates.SdkIndexState",
        return_value=SdkIndexState(sdk_versions={"example.sdk": "1.1.0"}),
    )
    def test_update_on_minor(self, mock_index_state):
        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event, None, IssueEventSerializer())
        assert result["sdkUpdates"] == [
            {
                "enables": [],
                "newSdkVersion": "1.1.0",
                "sdkName": "example.sdk",
                "sdkUrl": None,
                "type": "updateSdk",
            }
        ]

    @mock.patch(
        "sentry.sdk_updates.SdkIndexState",
        return_value=SdkIndexState(sdk_versions={"example.sdk": "1.0.1"}),
    )
    def test_ignores_patch(self, mock_index_state):
        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        result = serialize(event, None, IssueEventSerializer())
        assert result["sdkUpdates"] == []


class SqlFormatEventSerializerTest(TestCase):
    def test_event_breadcrumb_formatting(self):
        event = self.store_event(
            data={
                "breadcrumbs": [
                    {"category": "generic", "message": "should not format this"},
                    {
                        "category": "query",
                        "message": "select * from table where something = $1",
                    },
                ]
            },
            project_id=self.project.id,
        )
        result = serialize(event, None, SqlFormatEventSerializer())

        breadcrumb_entry = result["entries"][0]
        breadcrumbs = breadcrumb_entry["data"]["values"]

        assert breadcrumb_entry["type"] == "breadcrumbs"
        # First breadcrumb should not have a message_formatted property
        assert breadcrumbs[0]["message"] == "should not format this"
        assert "messageRaw" not in breadcrumbs[0]
        assert "messageFormat" not in breadcrumbs[0]
        # Second breadcrumb should have whitespace added
        assert breadcrumbs[1]["message"] == "select *\nfrom table\nwhere something = $1"
        assert breadcrumbs[1]["messageRaw"] == "select * from table where something = $1"
        assert breadcrumbs[1]["messageFormat"] == "sql"

    def test_event_breadcrumb_formatting_remove_quotes(self):
        event = self.store_event(
            data={
                "breadcrumbs": [
                    {
                        "category": "query",
                        "message": """select "table"."column_name", "table"."column name" from "table" where "something" = $1""",
                    },
                    {
                        "category": "query",
                        "message": """This is not "SQL" content.""",
                    },
                ]
            },
            project_id=self.project.id,
        )
        result = serialize(event, None, SqlFormatEventSerializer())

        # For breadcrumb 1: should remove quotes from all terms except the one that contains a space ("column name")
        assert (
            result["entries"][0]["data"]["values"][0]["message"]
            == """select table.column_name, table."column name"\nfrom table\nwhere something = $1"""
        )

        # For breadcrumb 2: Not SQL so shouldn't be changed
        assert (
            result["entries"][0]["data"]["values"][1]["message"] == """This is not "SQL" content."""
        )

    def test_adds_release_info(self):
        event = self.store_event(
            data={
                "tags": {
                    "sentry:release": "internal@1.0.0",
                }
            },
            project_id=self.project.id,
        )

        repo = self.create_repo(project=self.project, name=self.project.name)

        release = Release.objects.create(
            version="internal@1.0.0",
            organization=self.organization,
            date_released=datetime(2023, 1, 1, tzinfo=UTC),
        )
        release.add_project(self.project)
        release.set_commits(
            [
                {
                    "id": "917ac271787e74ff2dbe52b67e77afcff9aaa305",
                    "repository": repo.name,
                    "author_email": "bob@example.com",
                    "author_name": "Bob",
                    "message": "I hope this fixes it",
                    "patch_set": [{"path": "src/sentry/models/release.py", "type": "M"}],
                }
            ]
        )

        result = serialize(event, None, SqlFormatEventSerializer())

        assert result["release"]["version"] == "internal@1.0.0"
        assert result["release"]["lastCommit"]["id"] == "917ac271787e74ff2dbe52b67e77afcff9aaa305"

    def test_event_db_span_formatting(self):
        event_data = get_event("n-plus-one-in-django-new-view")
        event_data["contexts"] = {
            "trace": {
                "trace_id": "530c14e044aa464db6ddb43660e6474f",
                "span_id": "139fcdb7c5534eb4",
            }
        }
        event = self.store_event(
            data={
                "type": "transaction",
                "transaction": "/organizations/:orgId/performance/:eventSlug/",
                "start_timestamp": before_now(minutes=1, milliseconds=500).isoformat(),
                "timestamp": before_now(minutes=1).isoformat(),
                "contexts": {
                    "trace": {
                        "trace_id": "ff62a8b040f340bda5d830223def1d81",
                        "span_id": "8f5a2b8768cafb4e",
                        "type": "trace",
                    }
                },
                "spans": [
                    {
                        "description": """select "table"."column_name", "table"."column name" from "table" where "something" = $1""",
                        "op": "db",
                        "parent_span_id": "abe79ad9292b90a9",
                        "span_id": "9c045ea336297177",
                        "start_timestamp": before_now(minutes=1, milliseconds=200).timestamp(),
                        "timestamp": before_now(minutes=1).timestamp(),
                        "trace_id": "ff62a8b040f340bda5d830223def1d81",
                    },
                    {
                        "description": "http span",
                        "op": "http",
                        "parent_span_id": "a99fd04e79e17631",
                        "span_id": "abe79ad9292b90a9",
                        "start_timestamp": before_now(minutes=1, milliseconds=200).timestamp(),
                        "timestamp": before_now(minutes=1).timestamp(),
                        "trace_id": "ff62a8b040f340bda5d830223def1d81",
                    },
                ],
            },
            project_id=self.project.id,
        )
        result = serialize(event, None, SqlFormatEventSerializer())

        # For span 1: Should remove quotes from all terms except the one that contains a space ("column name")
        assert (
            result["entries"][0]["data"][0]["description"]
            == """select table.column_name, table."column name"\nfrom table\nwhere something = $1"""
        )

        # For span 2: Not a db span so no change
        assert result["entries"][0]["data"][1]["description"] == """http span"""

    def test_db_formatting_perf_optimizations(self):
        SQL_QUERY_OK = """select * from table where something in (%s, %s, %s)"""
        SQL_QUERY_TOO_LARGE = "a" * 1501

        event = self.store_event(
            data={
                "breadcrumbs": [
                    {
                        "category": "query",
                        "message": SQL_QUERY_OK,
                    },
                    {
                        "category": "query",
                        "message": SQL_QUERY_OK,
                    },
                    {
                        "category": "query",
                        "message": SQL_QUERY_TOO_LARGE,
                    },
                ]
                + [{"category": "query", "message": str(i)} for i in range(0, 30)]
            },
            project_id=self.project.id,
        )

        with mock.patch("sqlparse.format", return_value="") as mock_format:
            serialize(event, None, SqlFormatEventSerializer())

            assert (
                len(
                    list(
                        filter(
                            lambda args: SQL_QUERY_OK in args[0],
                            mock_format.call_args_list,
                        )
                    )
                )
                == 1
            ), "SQL_QUERY_OK should have been formatted a single time"

            assert not any(
                SQL_QUERY_TOO_LARGE in args[0] for args in mock_format.call_args_list
            ), "SQL_QUERY_TOO_LARGE should not have been formatted"

            assert mock_format.call_count == 20, "Format should have been called 20 times"
