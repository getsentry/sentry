# import datetime

# from snuba_sdk import Column, Condition, Entity, Function, Limit, Op, Query, Request

# from sentry.models.organization import Organization
# from sentry.models.project import Project
from sentry.replays.usecases.query import _make_ordered

# from sentry.utils.snuba import raw_snql_query


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
# snuba_params = SnubaParams(
#     organization=organization,
#     projects=projects,
#     start=start_date,
#     end=end_date,
# )

# Build the query
# builder = DiscoverQueryBuilder(
#     dataset=Dataset.Discover,
#     params={},
#     snuba_params=snuba_params,
#     query="issue.category:feedback arrayJoin(tags.value):os*",  # Filter tags starting with "os"
#     selected_columns=["tags.value", "count()"],  # Flatten the array here
#     # orderby=["-count()"],  # Sort by count descending
#     limit=10,  # Limit to top 10
#     config=QueryBuilderConfig(
#         auto_fields=False,
#         auto_aggregations=True,
#         use_aggregate_conditions=True,
#     ),
# )

# builder = DiscoverQueryBuilder(
#     dataset=Dataset.IssuePlatform,  # Use Issue Platform dataset for feedback
#     params={},
#     snuba_params=snuba_params,
#     query="issue.category:feedback",  # Only feedback events
#     selected_columns=[
#         "array_join(tags.key) as tag_key",  # Flatten the array
#         "array_join(tags.value) as tag_value",  # Flatten the array
#         "count()",
#     ],
#     orderby=["-count()"],
#     limit=100,  # Get more results
#     config=QueryBuilderConfig(
#         auto_fields=False,
#         auto_aggregations=True,
#         use_aggregate_conditions=True,
#         functions_acl=["array_join"],  # Allow array_join function
#     ),
# )

# builder = DiscoverQueryBuilder(
#     dataset=Dataset.IssuePlatform,
#     params={},
#     snuba_params=snuba_params,
#     query="issue.category:feedback",
#     selected_columns=["count()"],
#     config=QueryBuilderConfig(
#         auto_fields=False,
#         auto_aggregations=True,
#         use_aggregate_conditions=True,
#     ),
# )

# result = builder.run_query(referrer="test.debug_feedback")

# snql_query = builder.get_snql_query()
# results = raw_snql_query(snql_query, "api.organization-issue-replay-count")

# print(results)

# request = Request(
#     dataset="discover",
#     app_id="your_app_id",
#     # Define which organization and referrer this query is for
#     tenant_ids={"organization_id": 1},
#     query=Query(
#         # Use array_join to "un-nest" the tags so we can filter by key and group by value
#         array_join=Column("tags.key"),
#         match=Entity("discover"),
#         select=[
#             Column("tags.key"),
#             Column("tags.value"),
#             Function("count", [], "count"),
#         ],
#         # Filter the data before grouping
#         where=[
#             # Condition 1: Timestamp between two dates
#             Condition(Column("timestamp"), Op.GTE, datetime.datetime(2025, 6, 1, 0, 0, 0)),
#             Condition(Column("timestamp"), Op.LT, datetime.datetime(2025, 7, 21, 0, 0, 0)),
#             # Condition 2: Belongs to a specific project
#             Condition(Column("project_id"), Op.IN, [1, 2, 3, 4]),
#             # Condition 3: The tag's key must start with "os"
#             # Condition(Function("startsWith", [Column("tags.key"), "os"]), Op.EQ, 1),
#         ],
#         # Group by the tag value to count occurrences
#         groupby=[Column("tags.key"), Column("tags.value")],
#         # Order by the count descending to find the most frequent
#         orderby=[OrderBy(Column("count"), Direction.DESC)],
#         limit=Limit(10),
#     ),
# )

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


def test_make_ordered():
    """Test "_make_ordered" function."""
    # Assert ordered response.
    ordering = _make_ordered(["a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
    assert ordering[0]["replay_id"] == "a"
    assert ordering[1]["replay_id"] == "b"

    # Assert unordered response.
    ordering = _make_ordered(["b", "a"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
    assert ordering[0]["replay_id"] == "b"
    assert ordering[1]["replay_id"] == "a"

    # Assert accidental duplicate ordering key.
    ordering = _make_ordered(["b", "a", "a"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
    assert ordering[0]["replay_id"] == "b"
    assert ordering[1]["replay_id"] == "a"

    # Assert ordering key was not found.
    ordering = _make_ordered(["b", "a", "c"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
    assert ordering[0]["replay_id"] == "b"
    assert ordering[1]["replay_id"] == "a"

    # Assert missing result.
    ordering = _make_ordered(["b", "a"], [{"replay_id": "a"}])
    assert len(ordering) == 1
    assert ordering[0]["replay_id"] == "a"

    # Assert empty results returns no records.
    ordering = _make_ordered(["a"], [])
    assert len(ordering) == 0

    # Assert empty ordering keys returns empty results.
    ordering = _make_ordered([], [{"replay_id": "a"}])
    assert len(ordering) == 0

    ordering = _make_ordered(["a", "a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
    assert ordering[0]["replay_id"] == "a"

    # Assert empty results returns no records.
    ordering = _make_ordered(["a"], [])
    assert len(ordering) == 0

    # Assert empty ordering keys returns empty results.
    ordering = _make_ordered([], [{"replay_id": "a"}])
    assert len(ordering) == 0

    ordering = _make_ordered(["a", "a", "b"], [{"replay_id": "a"}, {"replay_id": "b"}])
    assert len(ordering) == 2
    assert len(ordering) == 2
    assert len(ordering) == 2
    assert len(ordering) == 2
