import datetime
from unittest import mock

from sentry import tsdb
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import (
    ExternalIssueSerializer,
    StreamGroupSerializer,
    StreamGroupSerializerSnuba,
)
from sentry.issues.grouptype import GroupCategory, ProfileFileIOGroupType
from sentry.models.environment import Environment
from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import region_silo_test
from tests.sentry.issues.test_utils import SearchIssueTestMixin


@region_silo_test
class StreamGroupSerializerTestCase(
    TestCase, SnubaTestCase, SearchIssueTestMixin, PerformanceIssueTestCase
):
    def test_environment(self):
        group = self.group

        environment = Environment.get_or_create(group.project, "production")

        with mock.patch("sentry.tsdb.get_range", side_effect=tsdb.backend.get_range) as get_range:
            serialize(
                [group],
                serializer=StreamGroupSerializer(
                    environment_func=lambda: environment, stats_period="14d"
                ),
            )
            assert get_range.call_count == 1
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] == [environment.id]

        def get_invalid_environment():
            raise Environment.DoesNotExist()

        with mock.patch(
            "sentry.tsdb.make_series",
            side_effect=tsdb.backend.make_series,
        ) as make_series:
            serialize(
                [group],
                serializer=StreamGroupSerializer(
                    environment_func=get_invalid_environment, stats_period="14d"
                ),
            )
            assert make_series.call_count == 1

    @freeze_time(before_now(days=1).replace(hour=13, minute=30, second=0, microsecond=0))
    def test_perf_issue(self):
        event = self.create_performance_issue()
        group = event.group
        serialized = serialize(
            group,
            serializer=StreamGroupSerializerSnuba(stats_period="24h", organization_id=1),
            request=self.make_request(),
        )
        assert serialized["count"] == "1"
        assert serialized["issueCategory"] == "performance"
        assert serialized["issueType"] == "performance_n_plus_one_db_queries"
        assert [stat[1] for stat in serialized["stats"]["24h"][:-1]] == [0] * 23
        assert serialized["stats"]["24h"][-1][1] == 1

    @freeze_time(before_now(days=1).replace(hour=13, minute=30, second=0, microsecond=0))
    def test_profiling_issue(self):
        proj = self.create_project()
        cur_time = before_now(minutes=5).replace(tzinfo=datetime.timezone.utc)
        event, occurrence, group_info = self.store_search_issue(
            proj.id, 1, [f"{ProfileFileIOGroupType.type_id}-group100"], None, cur_time
        )
        assert group_info
        serialized = serialize(
            group_info.group,
            serializer=StreamGroupSerializerSnuba(stats_period="24h", organization_id=1),
            request=self.make_request(),
        )
        assert serialized["count"] == "1"
        assert serialized["issueCategory"] == str(GroupCategory.PERFORMANCE.name).lower()
        assert serialized["issueType"] == str(ProfileFileIOGroupType.slug)
        assert [stat[1] for stat in serialized["stats"]["24h"][:-1]] == [0] * 23
        assert serialized["stats"]["24h"][-1][1] == 1


@region_silo_test
class ExternalIssueSerializerTestCase(TestCase, APITestCase):
    def test_external_issue_serializer(self):
        # integrations and external issues for group 1
        group_1 = self.create_group()
        integration_jira = self.create_integration(
            organization=group_1.organization,
            provider="jira",
            external_id="jira_external_id",
            name="Jira",
            metadata={"base_url": "https://example.com", "domain_name": "test/"},
        )
        integration_github = self.create_integration(
            organization=group_1.organization,
            provider="github",
            external_id="github_external_id",
            name="GitHub",
            metadata={"base_url": "https://example.com", "domain_name": "test/"},
        )
        external_issue_1a = self.create_integration_external_issue(
            group=group_1,
            integration=integration_github,
            key="APP-123-GH",
            title="github for group 1",
            description="this is an example description",
        )
        external_issue_1b = self.create_integration_external_issue(
            group=group_1,
            integration=integration_jira,
            key="APP-123-JIRA",
            title="jira for group 1",
            description="this is an example description",
        )

        # integrations and external issues for group 2
        group_2 = self.create_group()
        external_issue_2a = self.create_integration_external_issue(
            group=group_2,
            integration=integration_github,
            key="APP-456-GH",
            title="github for group 2",
            description="this is an example description",
        )
        external_issue_2b = self.create_integration_external_issue(
            group=group_2,
            integration=integration_jira,
            key="APP-456-JIRA",
            title="jira for group 2",
            description="this is an example description",
        )
        external_issue_2c = self.create_integration_external_issue(
            group=group_2,
            integration=integration_jira,
            key="APP-789-GH",
            title="another jira for group 2",
            description="this is an example description",
        )

        req = self.make_request()
        result = serialize(
            [group_1, group_2],
            request=req,
            serializer=ExternalIssueSerializer(),
        )

        assert len(result) == 2

        # group 1 should have 2 issues
        group_1_issues = result[0]["externalIssues"]
        assert len(group_1_issues) == 2
        assert group_1_issues[0].get("key") == external_issue_1a.key
        assert group_1_issues[1].get("key") == external_issue_1b.key
        assert group_1_issues[0].get("title") == external_issue_1a.title
        assert group_1_issues[1].get("title") == external_issue_1b.title
        assert group_1_issues[0].get("description") == external_issue_1a.description
        assert group_1_issues[1].get("description") == external_issue_1b.description
        assert group_1_issues[0].get("integrationKey") == integration_github.provider
        assert group_1_issues[1].get("integrationKey") == integration_jira.provider
        assert group_1_issues[0].get("integrationName") == integration_github.name
        assert group_1_issues[1].get("integrationName") == integration_jira.name

        # group 2 should have 3 issues
        group_2_issues = result[1]["externalIssues"]
        assert len(group_2_issues) == 3
        assert group_2_issues[0].get("key") == external_issue_2a.key
        assert group_2_issues[1].get("key") == external_issue_2b.key
        assert group_2_issues[2].get("key") == external_issue_2c.key
        assert group_2_issues[0].get("title") == external_issue_2a.title
        assert group_2_issues[1].get("title") == external_issue_2b.title
        assert group_2_issues[0].get("description") == external_issue_2a.description
        assert group_2_issues[2].get("description") == external_issue_2c.description
        assert group_2_issues[0].get("integrationKey") == integration_github.provider
        assert group_2_issues[2].get("integrationKey") == integration_jira.provider
        assert group_2_issues[0].get("integrationName") == integration_github.name
        assert group_2_issues[1].get("integrationName") == integration_jira.name
