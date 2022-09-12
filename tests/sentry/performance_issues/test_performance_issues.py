import logging
import uuid
from unittest import mock

from sentry.event_manager import EventManager
from sentry.spans.grouping.utils import hash_values
from sentry.testutils import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupCategory, GroupType
from tests.sentry.utils.performance_issues.test_performance_detection import EVENTS


def make_event(**kwargs):
    result = {
        "event_id": uuid.uuid1().hex,
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


class EventManagerTestMixin:
    def make_release_event(self, release_name, project_id):
        manager = EventManager(make_event(release=release_name))
        manager.normalize()
        event = manager.save(project_id)
        return event


@region_silo_test
class EventManagerTest(TestCase, EventManagerTestMixin):

    # GROUPS TESTS
    @override_options({"store.use-ingest-performance-detection-only": 1.0})
    @override_options({"performance.issues.all.problem-creation": 1.0})
    @override_options({"performance.issues.all.problem-detection": 1.0})
    def test_perf_issue_creation(self):
        self.project.update_option("sentry:performance_issue_creation_rate", 1.0)

        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"), self.feature(
            "projects:performance-suspect-spans-ingestion"
        ):
            manager = EventManager(make_event(**EVENTS["n-plus-one-in-django-index-view"]))
            manager.normalize()
            event = manager.save(self.project.id)
            data = event.data
            assert data["type"] == "transaction"
            assert data["span_grouping_config"]["id"] == "default:2021-08-25"
            spans = [{"hash": span["hash"]} for span in data["spans"]]
            # the basic strategy is to simply use the description
            assert spans == [{"hash": hash_values([span["description"]])} for span in data["spans"]]
            assert len(event.groups) == 1
            group = event.groups[0]
            assert group.title == "N+1 Query"
            assert group.message == "/books/"
            assert group.culprit == "/books/"
            assert group.get_event_type() == "transaction"
            assert group.get_event_metadata() == {
                "location": "/books/",
                "title": "N+1 Query",
                "value": "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
            }
            assert group.location() == "/books/"
            assert group.level == 40
            assert group.issue_category == GroupCategory.PERFORMANCE
            assert group.issue_type == GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES

    @override_options({"store.use-ingest-performance-detection-only": 1.0})
    @override_options({"performance.issues.all.problem-creation": 1.0})
    @override_options({"performance.issues.all.problem-detection": 1.0})
    def test_perf_issue_update(self):
        self.project.update_option("sentry:performance_issue_creation_rate", 1.0)

        with mock.patch("sentry_sdk.tracing.Span.containing_transaction"), self.feature(
            "projects:performance-suspect-spans-ingestion"
        ):
            manager = EventManager(make_event(**EVENTS["n-plus-one-in-django-index-view"]))
            manager.normalize()
            event = manager.save(self.project.id)
            group = event.groups[0]
            assert group.issue_category == GroupCategory.PERFORMANCE
            assert group.issue_type == GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES
            group.data["metadata"] = {
                "location": "hi",
                "title": "lol",
            }
            group.culprit = "wat"
            group.message = "nope"
            group.save()
            assert group.location() == "hi"
            assert group.title == "lol"

            manager = EventManager(make_event(**EVENTS["n-plus-one-in-django-index-view"]))
            manager.normalize()
            with self.tasks():
                manager.save(self.project.id)
            # Make sure the original group is updated via buffers
            group.refresh_from_db()
            assert group.title == "N+1 Query"

            assert group.get_event_metadata() == {
                "location": "/books/",
                "title": "N+1 Query",
                "value": "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
            }
            assert group.location() == "/books/"
            assert group.message == "/books/"
            assert group.culprit == "/books/"
