import datetime

from snuba_sdk import (
    Column,
    Condition,
    Entity,
    Function,
    Identifier,
    Lambda,
    Limit,
    Op,
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

        # snuba_params = SnubaParams(
        #     organization=self.org,
        #     projects=[self.project],
        #     start=start_date,
        #     end=end_date,
        # )

        # builder = DiscoverQueryBuilder(
        #     dataset=Dataset.Events,
        #     params={},
        #     snuba_params=snuba_params,
        #     query="event.type:feedback",
        #     selected_columns=["count()"],
        #     config=QueryBuilderConfig(
        #         auto_fields=False,
        #         auto_aggregations=True,
        #         use_aggregate_conditions=True,
        #     ),
        # )

        # result = builder.run_query(referrer="test.debug_feedback")

        # print(result["data"])

        # # This query finds the top 10 values for the tag prefix "foo", and gives the counts too. It seems to be working properly
        # builder = DiscoverQueryBuilder(
        #     dataset=Dataset.Events,
        #     params={},
        #     snuba_params=snuba_params,
        #     query="event.type:feedback",
        #     selected_columns=[
        #         "array_join(tags.value) as tag_value",  # Only get the value, not the key
        #         "count()",
        #     ],
        #     orderby=["-count()"],
        #     limit=10,  # Get top 10 values
        #     config=QueryBuilderConfig(
        #         auto_fields=False,
        #         auto_aggregations=True,
        #         use_aggregate_conditions=True,
        #         functions_acl=["array_join"],
        #     ),
        # )

        # builder.add_conditions(
        #     [
        #         Condition(
        #             Function("startsWith", [Function("arrayJoin", [Column("tags.key")]), "foo"]),
        #             Op.EQ,
        #             1,
        #         )
        #     ]
        # )

        # result = builder.run_query(referrer="test.debug_feedback")

        # print(result["data"])
        # result

        # # This query finds all feedbacks that have any tag starting with "foo" equal to 1
        # # Q: how does it know that only foo-prefixed tags are being considered when checking equality to 1?
        # builder2 = DiscoverQueryBuilder(
        #     dataset=Dataset.Events,
        #     params={},
        #     snuba_params=snuba_params,
        #     query="event.type:feedback",  # Filter for feedback events
        #     selected_columns=["event_id", "project_id", "timestamp", "tags.key", "tags.value"],
        #     orderby=["-timestamp"],  # Most recent first
        #     limit=100,  # Get up to 100 events
        #     config=QueryBuilderConfig(
        #         auto_fields=False,
        #         auto_aggregations=True,
        #         use_aggregate_conditions=True,
        #         functions_acl=["array_join"],  # Allow array_join function
        #     ),
        # )

        # builder2.add_conditions(
        #     [
        #         Condition(
        #             Function("startsWith", [Function("arrayJoin", [Column("tags.key")]), "foo"]),
        #             Op.EQ,
        #             1,
        #         ),
        #         Condition(
        #             Function("arrayJoin", [Column("tags.value")]),
        #             Op.EQ,
        #             "1",
        #         ),
        #     ]
        # )

        # print(builder2.get_snql_query())

        # result = builder2.run_query(referrer="test.debug_feedback")

        # print("Feedbacks with any tag starting with 'foo' equal to '1':")
        # print(result["data"])

        # First, we want to find the top 10 values for the tag prefix "foo" for feedbacks filtered by some date range and project
        request = Request(
            dataset="discover",
            app_id="your_app_id",
            # Define which organization and referrer this query is for
            tenant_ids={"organization_id": self.org.id},
            query=Query(
                match=Entity("discover"),
                select=[
                    # Column("tags.key"),
                    # Column("tags.value"),
                    # Function("count", [], "count"),
                    Function(
                        "arrayJoin",
                        parameters=[
                            Function(
                                "arrayMap",
                                parameters=[
                                    Lambda(
                                        ["x"],
                                        Function(
                                            "tupleElement",
                                            parameters=[
                                                Identifier(
                                                    "x"
                                                ),  # Why do we need a lambda inside a function?
                                                2,
                                            ],  # I think this gets the second tuple element, which is the value
                                        ),
                                    ),
                                    Function(
                                        "arrayZip",
                                        parameters=[Column("tags.key"), Column("tags.value")],
                                    ),
                                ],
                            )
                        ],
                        alias="tag_value",  # Add a short alias here
                    )
                ],
                # Filter the data before grouping
                where=[
                    # Condition 1: Timestamp between two dates
                    Condition(Column("timestamp"), Op.GTE, start_date),
                    Condition(Column("timestamp"), Op.LT, end_date),
                    # Condition 2: Belongs to a specific project
                    Condition(Column("project_id"), Op.IN, [self.project.id]),
                    # Condition 3: The tag's key must start with "os"
                    # Condition(Function("startsWith", [Column("tags.key"), "os"]), Op.EQ, 1),
                ],
                # Group by the tag value to count occurrences
                # groupby=[Column("tags.key"), Column("tags.value")],
                # Order by the count descending to find the most frequent
                # orderby=[OrderBy(Column("count"), Direction.DESC)],
                limit=Limit(10),
            ),
        )

        results = raw_snql_query(request, "api.organization-issue-replay-count")

        results
        # print(results["data"])

        assert False


# def test_vishnu_query():
#     organization = Organization.objects.get()
#     projects = [
#         Project.objects.get(id=1),
#         Project.objects.get(id=2),
#         Project.objects.get(id=3),
#         Project.objects.get(id=4),
#     ]  # Your projects
#     start_date = datetime.datetime.now() - datetime.timedelta(days=90)
#     end_date = datetime.datetime.now()

# Create SnubaParams
#     snuba_params = SnubaParams(
#         organization=organization,
#         projects=projects,
#         start=start_date,
#         end=end_date,
#     )

# # Build the query
#     builder = DiscoverQueryBuilder(
#         dataset=Dataset.Discover,
#         params={},
#         snuba_params=snuba_params,
#         query="issue.category:feedback arrayJoin(tags.value):os*",  # Filter tags starting with "os"
#         selected_columns=["tags.value", "count()"],  # Flatten the array here
#         # orderby=["-count()"],  # Sort by count descending
#         limit=10,  # Limit to top 10
#         config=QueryBuilderConfig(
#             auto_fields=False,
#             auto_aggregations=True,
#             use_aggregate_conditions=True,
#         ),
#     )

#     builder = DiscoverQueryBuilder(
#         dataset=Dataset.IssuePlatform,  # Use Issue Platform dataset for feedback
#         params={},
#         snuba_params=snuba_params,
#         query="issue.category:feedback",  # Only feedback events
#         selected_columns=[
#             "array_join(tags.key) as tag_key",  # Flatten the array
#             "array_join(tags.value) as tag_value",  # Flatten the array
#             "count()",
#         ],
#         orderby=["-count()"],
#         limit=100,  # Get more results
#         config=QueryBuilderConfig(
#             auto_fields=False,
#             auto_aggregations=True,
#             use_aggregate_conditions=True,
#             functions_acl=["array_join"],  # Allow array_join function
#         ),
#     )

#     builder = DiscoverQueryBuilder(
#         dataset=Dataset.IssuePlatform,
#         params={},
#         snuba_params=snuba_params,
#         query="issue.category:feedback",
#         selected_columns=["count()"],
#         config=QueryBuilderConfig(
#             auto_fields=False,
#             auto_aggregations=True,
#             use_aggregate_conditions=True,
#         ),
#     )

#     result = builder.run_query(referrer="test.debug_feedback")

#     snql_query = builder.get_snql_query()
#     results = raw_snql_query(snql_query, "api.organization-issue-replay-count")

#     print(results)

#     request = Request(
#         dataset="discover",
#         app_id="your_app_id",
#         # Define which organization and referrer this query is for
#         tenant_ids={"organization_id": 1},
#         query=Query(
#             # Use array_join to "un-nest" the tags so we can filter by key and group by value
#             array_join=Column("tags.key"),
#             match=Entity("discover"),
#             select=[
#                 Column("tags.key"),
#                 Column("tags.value"),
#                 Function("count", [], "count"),
#             ],
#             # Filter the data before grouping
#             where=[
#                 # Condition 1: Timestamp between two dates
#                 Condition(Column("timestamp"), Op.GTE, datetime.datetime(2025, 6, 1, 0, 0, 0)),
#                 Condition(Column("timestamp"), Op.LT, datetime.datetime(2025, 7, 21, 0, 0, 0)),
#                 # Condition 2: Belongs to a specific project
#                 Condition(Column("project_id"), Op.IN, [1, 2, 3, 4]),
#                 # Condition 3: The tag's key must start with "os"
#                 # Condition(Function("startsWith", [Column("tags.key"), "os"]), Op.EQ, 1),
#             ],
#             # Group by the tag value to count occurrences
#             groupby=[Column("tags.key"), Column("tags.value")],
#             # Order by the count descending to find the most frequent
#             orderby=[OrderBy(Column("count"), Direction.DESC)],
#             limit=Limit(10),
#         ),
#     )

# request = Request(
#     dataset="search_issues",  # Use Issue Platform dataset for feedback events
#     app_id="test_app",
#     tenant_ids={"organization_id": organization.id},
#     query=Query(
#         match=Entity("search_issues"),  # Use search_issues entity
#         select=[
#             Function("count", [], "count"),
#         ],
#         # Filter the data before grouping
#         where=[
#             # # Condition 1: Timestamp between two dates
#             Condition(Column("timestamp"), Op.GTE, start_date),
#             Condition(Column("timestamp"), Op.LT, end_date),
#             # # Condition 2: Belongs to a specific project
#             Condition(Column("project_id"), Op.IN, [p.id for p in projects]),
#             # # Condition 3: Only feedback events
#             Condition(Column("issue.category"), Op.EQ, "feedback"),
#         ],
#         limit=Limit(1),
#     ),
# )

# results = raw_snql_query(request, "api.organization-issue-replay-count")

# print(results)

# assert True

# request = Request(
#     dataset="discover",
#     app_id="your_app_id",
#     # Define which organization and referrer this query is for
#     tenant_ids={"organization_id": 1234},
#     query=Query(
#         # Use array_join to "un-nest" the tags so we can filter by key and group by value
#         array_join=Column("tags"),
#         match=Entity("discover"),
#         select=[
#             Column("tags.value"),
#             Function("count", [], "count"),
#         ],
#         # Filter the data before grouping
#         where=[
#             # Condition 1: Timestamp between two dates
#             Condition(Column("timestamp"), Op.GTE, datetime.datetime(2025, 7, 20, 0, 0, 0)),
#             Condition(Column("timestamp"), Op.LT, datetime.datetime(2025, 7, 21, 0, 0, 0)),
#             # Condition 2: Belongs to a specific project
#             Condition(Column("project_id"), Op.IN, [1]),
#             # Condition 3: The tag's key must start with "os"
#             Condition(Function("startsWith", [Column("tags.key"), "os"]), Op.EQ, 1),
#         ],
#         # Group by the tag value to count occurrences
#         groupby=[Column("tags.value")],
#         # Order by the count descending to find the most frequent
#         orderby=[OrderBy(Column("count"), Direction.DESC)],
#         limit=Limit(10),
#     ),
# )

# snql_query = builder.get_snql_query()
# results = raw_snql_query(snql_query, "api.organization-events-spans-performance-suspects")


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
