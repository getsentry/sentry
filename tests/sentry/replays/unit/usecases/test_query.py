import datetime

from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Identifier,
    Lambda,
    Limit,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.eventstore.snuba.backend import SnubaEventStorage
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test
from sentry.utils.snuba import raw_snql_query


@region_silo_test
class TestQuery(APITestCase, SnubaTestCase):

    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.eventstore = SnubaEventStorage()

    def test_store_and_query_feedback(self):
        self.store_event(
            data={
                "event_id": "d" * 32,
                "type": "feedback",  # This makes it a feedback event
                "platform": "python",
                "fingerprint": ["group2"],
                "timestamp": before_now(days=14).isoformat(),
                "tags": {"foo.1": "1"},
                # Required feedback context
                "contexts": {
                    "feedback": {
                        "contact_email": "test@example.com",
                        "name": "Test User",
                        "message": "This is a test feedback message",
                        "url": "https://example.com/feedback",
                    },
                },
            },
            project_id=self.project.id,  # Use the created project's ID
        )
        self.store_event(
            data={
                "event_id": "a" * 32,
                "type": "feedback",  # This makes it a feedback event
                "platform": "python",
                "fingerprint": ["group1"],
                "timestamp": before_now(days=14).isoformat(),
                "tags": {"foo.2": "1"},
                # Required feedback context
                "contexts": {
                    "feedback": {
                        "contact_email": "test@example.com",
                        "name": "Test User",
                        "message": "This is a test feedback message",
                        "url": "https://example.com/feedback",
                    },
                },
            },
            project_id=self.project.id,  # Use the created project's ID
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "type": "feedback",  # This makes it a feedback event
                "platform": "python",
                "fingerprint": ["group5"],
                "timestamp": before_now(days=14).isoformat(),
                "tags": {"feedback.1": "1", "foo.2": "2"},
                # Required feedback context
                "contexts": {
                    "feedback": {
                        "contact_email": "test@example.com",
                        "name": "Test User",
                        "message": "This is a test feedback message",
                        "url": "https://example.com/feedback",
                    },
                },
            },
            project_id=self.project.id,  # Use the created project's ID
        )

        start_date = datetime.datetime.now() - datetime.timedelta(days=90)
        end_date = datetime.datetime.now()

        # First, we want to find the top 10 values for the tag prefix "foo" for feedbacks filtered by some date range and project
        request = Request(
            dataset="discover",
            app_id="your_app_id",
            # Define which organization and referrer this query is for
            tenant_ids={"organization_id": self.org.id},
            query=Query(
                match=Entity("discover"),
                select=[
                    Function("count", [], "count"),
                    Function(
                        "arrayJoin",
                        parameters=[
                            Function(
                                "arrayMap",
                                parameters=[
                                    Lambda(
                                        ["tup"],
                                        Function(
                                            "tupleElement",
                                            parameters=[
                                                Identifier("tup"),
                                                2,
                                            ],  # I think this gets the second tuple element, which is the tag's value
                                        ),
                                    ),
                                    Function(
                                        "arrayFilter",
                                        parameters=[
                                            Lambda(
                                                ["tup"],
                                                Function(
                                                    "startsWith",  # Checks if the tag's key starts with "foo"
                                                    parameters=[
                                                        Function(
                                                            "tupleElement",
                                                            parameters=[
                                                                Identifier("tup"),
                                                                1,
                                                            ],  # Returns the first tuple element (tag's key)
                                                        ),
                                                        "foo",
                                                    ],
                                                ),
                                            ),
                                            Function(
                                                "arrayZip",
                                                parameters=[
                                                    Column("tags.key"),
                                                    Column("tags.value"),
                                                ],
                                            ),
                                        ],
                                    ),
                                ],
                            )
                        ],
                        alias="tag_value",
                    ),
                ],
                # Filter the data before grouping
                where=[
                    # Condition 1: Timestamp between two dates
                    Condition(Column("timestamp"), Op.GTE, start_date),
                    Condition(Column("timestamp"), Op.LT, end_date),
                    # Condition 2: Belongs to a specific project
                    Condition(Column("project_id"), Op.IN, [self.project.id]),
                ],
                groupby=[
                    Column(
                        "tag_value"
                    ),  # is this ok? can I group by an alias that was in select, or would I have to repeat the entire expression? This seems to be done in other places...
                ],
                # Order by the count descending to find the most frequent
                orderby=[OrderBy(Column("count"), Direction.DESC)],
                limit=Limit(10),
            ),
        )

        results = raw_snql_query(request, "api.organization-issue-replay-count")

        results
        # print(results["data"])

        # Now, we want all of the feedbacks that have a tag starting with "foo" equal to 1. We want the actual feedback data itself.
        # In prod, we'll want a list of potential tag values, not just one like we have here, so we'll probably have to use hasAny instead of equals
        feedbacksreq = Request(
            dataset="discover",
            app_id="your_app_id",
            tenant_ids={"organization_id": self.org.id},
            query=Query(
                match=Entity("discover"),
                select=[Column("event_id"), Column("tags.value"), Column("tags.key")],
                where=[
                    # Condition 1: Timestamp between two dates
                    Condition(Column("timestamp"), Op.GTE, start_date),
                    Condition(Column("timestamp"), Op.LT, end_date),
                    # Condition 2: Belongs to a specific project
                    Condition(Column("project_id"), Op.IN, [self.project.id]),
                    # Want to find all feedbacks that have a tag starting with "foo" equal to 1, so do an arrayExists
                    Condition(
                        Function(
                            "arrayExists",
                            parameters=[
                                Lambda(
                                    ["tup"],
                                    Function(
                                        "and",
                                        parameters=[
                                            Function(
                                                "startsWith",
                                                parameters=[
                                                    Function(
                                                        "tupleElement", [Identifier("tup"), 1]
                                                    ),
                                                    "foo",
                                                ],
                                            ),
                                            Function(
                                                "equals",
                                                parameters=[
                                                    Function(
                                                        "tupleElement", [Identifier("tup"), 2]
                                                    ),
                                                    "1",
                                                ],
                                            ),
                                        ],
                                    ),
                                ),
                                Function(
                                    "arrayZip",
                                    parameters=[Column("tags.key"), Column("tags.value")],
                                ),
                            ],
                        ),
                        Op.EQ,
                        1,
                    ),
                ],
            ),
        )

        feedbacksres = raw_snql_query(feedbacksreq, "api.organization-issue-replay-count")

        feedbacksres
        # print(feedbacksres["data"])

        # Now, we want to find just a list of all of the tags where the key starts with "foo"
        # This query should be similar to the one that finds the top 10 values for the tag prefix "foo" for feedbacks filtered by some date range and project, so it is ommitted for now

        # Query: want to get all feedbacks in projects / date range, then get all of the tags (prob just values are needed) where the key starts with "foo"
        # Can do the above with an arrayZip, arrayFilter, and arrayMap, so we should be good

        assert False


# def test_make_ordered():
#     """Test "_make_ordered" function."""
#     # Assert ordered response.
#     ordering = _make_ordered(["a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
#     assert len(ordering) == 2
#     assert ordering[0]["replay_id"] == "a"
#     assert ordering[1]["replay_id"] == "b"

#     # Assert unordered response.
#     ordering = _make_ordered(["b", "a"], [{"replay_id": "a"}, {"replay_id": "b"}])
#     assert len(ordering) == 2
#     assert ordering[0]["replay_id"] == "b"
#     assert ordering[1]["replay_id"] == "a"

#     # Assert accidental duplicate ordering key.
#     ordering = _make_ordered(["b", "a", "a"], [{"replay_id": "a"}, {"replay_id": "b"}])
#     assert len(ordering) == 2
#     assert ordering[0]["replay_id"] == "b"
#     assert ordering[1]["replay_id"] == "a"

#     # Assert ordering key was not found.
#     ordering = _make_ordered(["b", "a", "c"], [{"replay_id": "a"}, {"replay_id": "b"}])
#     assert len(ordering) == 2
#     assert ordering[0]["replay_id"] == "b"
#     assert ordering[1]["replay_id"] == "a"

#     # Assert missing result.
#     ordering = _make_ordered(["b", "a"], [{"replay_id": "a"}])
#     assert len(ordering) == 1
#     assert ordering[0]["replay_id"] == "a"

#     # Assert empty results returns no records.
#     ordering = _make_ordered(["a"], [])
#     assert len(ordering) == 0

#     # Assert empty ordering keys returns empty results.
#     ordering = _make_ordered([], [{"replay_id": "a"}])
#     assert len(ordering) == 0

#     ordering = _make_ordered(["a", "a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
#     assert len(ordering) == 2
#     assert ordering[0]["replay_id"] == "a"

#     # Assert empty results returns no records.
#     ordering = _make_ordered(["a"], [])
#     assert len(ordering) == 0

#     # Assert empty ordering keys returns empty results.
#     ordering = _make_ordered([], [{"replay_id": "a"}])
#     assert len(ordering) == 0

#     ordering = _make_ordered(["a", "a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2

#     # Assert empty ordering keys returns empty results.
#     ordering = _make_ordered([], [{"replay_id": "a"}])
#     assert len(ordering) == 0

#     ordering = _make_ordered(["a", "a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     ordering = _make_ordered([], [{"replay_id": "a"}])
#     assert len(ordering) == 0

#     ordering = _make_ordered(["a", "a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     ordering = _make_ordered([], [{"replay_id": "a"}])
#     assert len(ordering) == 0

#     ordering = _make_ordered(["a", "a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
#     assert len(ordering) == 2
