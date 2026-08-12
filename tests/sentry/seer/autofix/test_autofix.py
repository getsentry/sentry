from datetime import timedelta
from unittest.mock import MagicMock, call, patch

import pytest

from sentry.seer.agent.utils import _convert_profile_to_execution_tree
from sentry.seer.autofix.autofix import get_all_tags_overview
from sentry.seer.utils import get_github_username_for_user
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class TestConvertProfileToExecutionTree(TestCase):
    def test_convert_profile_to_execution_tree(self) -> None:
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "helper",
                        "module": "app.utils",
                        "filename": "utils.py",
                        "lineno": 20,
                        "in_app": True,
                    },
                    {
                        "function": "external",
                        "module": "external.lib",
                        "filename": "lib.py",
                        "lineno": 30,
                        "in_app": False,
                    },
                ],
                "stacks": [
                    [2, 1, 0]
                ],  # One stack with three frames. In a call stack, the first function is the last frame
                "samples": [{"stack_id": 0, "thread_id": "1", "elapsed_since_start_ns": 10000000}],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

        # Should only include in_app frames from the selected thread (MainThread in this case)
        assert selected_thread_id == "1"
        assert len(execution_tree) == 1  # One root node
        root = execution_tree[0]
        assert root["function"] == "main"
        assert root["module"] == "app.main"
        assert root["filename"] == "main.py"
        assert root["lineno"] == 10
        assert len(root["children"]) == 1

        child = root["children"][0]
        assert child["function"] == "helper"
        assert child["module"] == "app.utils"
        assert child["filename"] == "utils.py"
        assert child["lineno"] == 20
        assert len(child["children"]) == 0  # No children for the last in_app frame

    def test_convert_profile_to_execution_tree_non_main_thread(self) -> None:
        """Test that the thread with in_app frames is selected (even if not MainThread)"""
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "worker",
                        "module": "app.worker",
                        "filename": "worker.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0]],
                "samples": [{"stack_id": 0, "thread_id": "2", "elapsed_since_start_ns": 10000000}],
                "thread_metadata": {"2": {"name": "WorkerThread"}, "3": {"name": "WorkerThread2"}},
            }
        }

        execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

        # Should include the worker thread since it has in_app frames
        assert selected_thread_id == "2"
        assert len(execution_tree) == 1
        assert execution_tree[0]["function"] == "worker"
        assert execution_tree[0]["filename"] == "worker.py"

    def test_convert_profile_to_execution_tree_merges_duplicate_frames(self) -> None:
        """Test that duplicate frames in different samples are merged correctly"""
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0], [0]],  # Two stacks with the same frame
                "samples": [
                    {"stack_id": 0, "thread_id": "1", "elapsed_since_start_ns": 10000000},
                    {"stack_id": 1, "thread_id": "1", "elapsed_since_start_ns": 20000000},
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

        # Should only have one node even though frame appears in multiple samples
        assert selected_thread_id == "1"
        assert len(execution_tree) == 1
        assert execution_tree[0]["function"] == "main"

    def test_convert_profile_to_execution_tree_calculates_durations(self) -> None:
        """Test that durations are correctly calculated for nodes in the execution tree"""
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "process_data",
                        "module": "app.processing",
                        "filename": "processing.py",
                        "lineno": 25,
                        "in_app": True,
                    },
                    {
                        "function": "save_result",
                        "module": "app.storage",
                        "filename": "storage.py",
                        "lineno": 50,
                        "in_app": True,
                    },
                ],
                # Three stacks representing a call sequence: main → process_data → save_result → process_data → main
                "stacks": [
                    [0],  # main only
                    [1, 0],  # main → process_data
                    [2, 1, 0],  # main → process_data → save_result
                    [1, 0],  # main → process_data (returned from save_result)
                    [0],  # main only (returned from process_data)
                ],
                # 5 samples at 10ms intervals
                "samples": [
                    {
                        "stack_id": 0,
                        "thread_id": "1",
                        "elapsed_since_start_ns": 10000000,
                    },  # 10ms: main
                    {
                        "stack_id": 1,
                        "thread_id": "1",
                        "elapsed_since_start_ns": 20000000,
                    },  # 20ms: main → process_data
                    {
                        "stack_id": 2,
                        "thread_id": "1",
                        "elapsed_since_start_ns": 30000000,
                    },  # 30ms: main → process_data → save_result
                    {
                        "stack_id": 1,
                        "thread_id": "1",
                        "elapsed_since_start_ns": 40000000,
                    },  # 40ms: main → process_data
                    {
                        "stack_id": 0,
                        "thread_id": "1",
                        "elapsed_since_start_ns": 50000000,
                    },  # 50ms: main
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

        # Should have one root node (main)
        assert selected_thread_id == "1"
        assert len(execution_tree) == 1
        root = execution_tree[0]
        assert root["function"] == "main"

        # Check root duration - should span the entire profile (50ms - 10ms + 10ms interval = 50ms)
        assert root["duration_ns"] == 50000000

        # Check process_data duration - should be active from 20ms to 40ms (20ms + 10ms interval = 30ms)
        assert len(root["children"]) == 1
        process_data = root["children"][0]
        assert process_data["function"] == "process_data"
        assert process_data["duration_ns"] == 30000000

        # Check save_result duration - should be active only at 30ms (10ms interval = 10ms)
        assert len(process_data["children"]) == 1
        save_result = process_data["children"][0]
        assert save_result["function"] == "save_result"
        assert save_result["duration_ns"] == 10000000

    def test_convert_profile_to_execution_tree_with_timestamp(self) -> None:
        """Test that _convert_profile_to_execution_tree works with continuous profiles using timestamp"""
        profile_data = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app.main",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "helper",
                        "module": "app.utils",
                        "filename": "utils.py",
                        "lineno": 20,
                        "in_app": True,
                    },
                ],
                "stacks": [
                    [0],  # main only
                    [1, 0],  # main → helper
                ],
                # Samples using timestamp instead of elapsed_since_start_ns
                "samples": [
                    {
                        "stack_id": 0,
                        "thread_id": "1",
                        "timestamp": 1672567200.0,  # Base timestamp (Unix timestamp)
                    },
                    {
                        "stack_id": 1,
                        "thread_id": "1",
                        "timestamp": 1672567200.01,  # 10ms later
                    },
                    {
                        "stack_id": 0,
                        "thread_id": "1",
                        "timestamp": 1672567200.02,  # 20ms later
                    },
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

        # Should have one root node (main)
        assert selected_thread_id == "1"
        assert len(execution_tree) == 1
        root = execution_tree[0]
        assert root["function"] == "main"
        assert root["module"] == "app.main"
        assert root["filename"] == "main.py"
        assert root["lineno"] == 10

        # Should have one child (helper)
        assert len(root["children"]) == 1
        child = root["children"][0]
        assert child["function"] == "helper"
        assert child["module"] == "app.utils"
        assert child["filename"] == "utils.py"
        assert child["lineno"] == 20
        assert len(child["children"]) == 0

        # Check durations are calculated correctly from timestamps
        # Root should span from 0ns to 20ms (0.02s * 1e9 = 20000000ns) + interval
        # Allow for small floating point precision differences
        assert abs(root["duration_ns"] - 30000000) < 100  # 20ms + 10ms interval
        # Helper should be active from 10ms to 10ms (10ms interval = 10000000ns)
        assert abs(child["duration_ns"] - 10000000) < 100


@pytest.mark.django_db
class TestGetAllTagsOverview(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()

        # Create events with real tag data
        # Event 1: production environment with user_role admin
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "environment": "production",
                "tags": {"user_role": "admin", "service": "api"},
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )

        # Event 2: production environment with user_role admin (duplicate to test counts)
        event2 = self.store_event(
            data={
                "fingerprint": ["group-1"],
                "environment": "production",
                "tags": {"user_role": "admin", "service": "web"},
                "timestamp": before_now(minutes=2).isoformat(),
            },
            project_id=self.project.id,
        )

        # Event 3: staging environment with user_role user
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "environment": "staging",
                "tags": {"user_role": "user", "service": "api"},
                "timestamp": before_now(minutes=3).isoformat(),
            },
            project_id=self.project.id,
        )

        # Event 4: development environment with user_role user
        self.store_event(
            data={
                "fingerprint": ["group-1"],
                "environment": "development",
                "tags": {"user_role": "user", "service": "worker"},
                "timestamp": before_now(minutes=4).isoformat(),
            },
            project_id=self.project.id,
        )

        self.group = event2.group

    def test_get_all_tags_overview_basic(self) -> None:
        """Test basic functionality of getting all tags overview with real data."""
        result = get_all_tags_overview(self.group)

        assert result is not None
        assert "tags_overview" in result

        # Should have environment, user_role, and service tags, but not level since it's excluded
        assert len(result["tags_overview"]) >= 3

        # Find specific tags
        tag_keys = {tag["key"]: tag for tag in result["tags_overview"]}

        # Check environment tag (built-in Sentry tag)
        assert "environment" in tag_keys
        env_tag = tag_keys["environment"]
        assert env_tag["name"] == "Environment"
        assert env_tag["total_values"] == 4  # 4 events

        # Should have production (2), staging (1), development (1)
        env_values = {val["value"]: val for val in env_tag["top_values"]}
        assert "production" in env_values
        assert env_values["production"]["count"] == 2
        assert env_values["production"]["percentage"] == "50%"

        # Check custom tag
        assert "user_role" in tag_keys
        user_tag = tag_keys["user_role"]
        assert user_tag["name"] == "User Role"  # Should get proper label
        assert user_tag["total_values"] == 4

        user_values = {val["value"]: val for val in user_tag["top_values"]}
        assert "admin" in user_values
        assert "user" in user_values
        assert user_values["admin"]["count"] == 2
        assert user_values["user"]["count"] == 2

    def test_get_all_tags_overview_percentage_calculation(self) -> None:
        """Test that percentage calculations work correctly."""
        result = get_all_tags_overview(self.group)

        assert result is not None

        # Find environment tag (we know this exists from setUp)
        env_tag = next(
            (tag for tag in result["tags_overview"] if tag["key"] == "environment"), None
        )
        assert env_tag is not None
        assert env_tag["total_values"] == 4  # 4 events from setUp

        # Check that percentages add up correctly
        env_values = {val["value"]: val for val in env_tag["top_values"]}

        # Verify percentage calculation for known values
        # Production should be 2/4 = 50%
        assert "production" in env_values
        production_val = env_values["production"]
        assert production_val["count"] == 2
        assert production_val["percentage"] == "50%"

        # Development and staging should each be 1/4 = 25%
        assert "development" in env_values
        dev_val = env_values["development"]
        assert dev_val["count"] == 1
        assert dev_val["percentage"] == "25%"

        assert "staging" in env_values
        staging_val = env_values["staging"]
        assert staging_val["count"] == 1
        assert staging_val["percentage"] == "25%"

    def test_get_all_tags_overview_respects_time_range(self) -> None:
        """Only include tag counts for events within the provided time window (event 2 and 3)"""
        now = before_now(minutes=0)
        start = now - timedelta(minutes=3, seconds=30)
        end = now - timedelta(minutes=1, seconds=30)

        result = get_all_tags_overview(self.group, start=start, end=end)

        assert result is not None
        tags = {tag["key"]: tag for tag in result["tags_overview"]}

        env_tag = tags["environment"]
        assert env_tag["total_values"] == 2  # events ~2m and ~3m ago
        env_values = {val["value"]: val for val in env_tag["top_values"]}
        assert set(env_values.keys()) == {"production", "staging"}
        assert env_values["production"]["count"] == 1
        assert env_values["staging"]["count"] == 1

        user_tag = tags["user_role"]
        assert user_tag["total_values"] == 2
        user_values = {val["value"]: val for val in user_tag["top_values"]}
        assert set(user_values.keys()) == {"admin", "user"}
        assert user_values["admin"]["count"] == 1
        assert user_values["user"]["count"] == 1


class TestGetGithubUsernameForUser(TestCase):
    def test_get_github_username_for_user_with_github(self) -> None:
        """Tests getting GitHub username from ExternalActor with GitHub provider."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders

        user = self.create_user()
        organization = self.create_organization()

        # Create an ExternalActor with GitHub provider
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@testuser",
            external_id="12345",
            integration_id=1,
        )

        username = get_github_username_for_user(user, organization.id)
        assert username == "testuser"

    def test_get_github_username_for_user_with_github_enterprise(self) -> None:
        """Tests getting GitHub username from ExternalActor with GitHub Enterprise provider."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders

        user = self.create_user()
        organization = self.create_organization()

        # Create an ExternalActor with GitHub Enterprise provider
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB_ENTERPRISE.value,
            external_name="@gheuser",
            external_id="67890",
            integration_id=2,
        )

        username = get_github_username_for_user(user, organization.id)
        assert username == "gheuser"

    def test_get_github_username_for_user_without_at_prefix(self) -> None:
        """Tests getting GitHub username when external_name doesn't have @ prefix."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders

        user = self.create_user()
        organization = self.create_organization()

        # Create an ExternalActor without @ prefix
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="noprefixuser",
            external_id="11111",
            integration_id=3,
        )

        username = get_github_username_for_user(user, organization.id)
        assert username == "noprefixuser"

    def test_get_github_username_for_user_no_mapping(self) -> None:
        """Tests that None is returned when user has no GitHub mapping."""
        user = self.create_user()
        organization = self.create_organization()

        username = get_github_username_for_user(user, organization.id)
        assert username is None

    def test_get_github_username_for_user_non_github_provider(self) -> None:
        """Tests that None is returned when user only has non-GitHub external actors."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders

        user = self.create_user()
        organization = self.create_organization()

        # Create an ExternalActor with Slack provider (should be ignored)
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.SLACK.value,
            external_name="@slackuser",
            external_id="slack123",
            integration_id=4,
        )

        username = get_github_username_for_user(user, organization.id)
        assert username is None

    def test_get_github_username_for_user_multiple_mappings(self) -> None:
        """Tests that most recent GitHub mapping is used when multiple exist."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders

        user = self.create_user()
        organization = self.create_organization()

        # Create older mapping
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@olduser",
            external_id="old123",
            integration_id=5,
            date_added=before_now(days=10),
        )

        # Create newer mapping
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@newuser",
            external_id="new456",
            integration_id=6,
            date_added=before_now(days=1),
        )

        username = get_github_username_for_user(user, organization.id)
        assert username == "newuser"

    def test_get_github_username_for_user_from_commit_author(self) -> None:
        """Tests getting GitHub username from CommitAuthor when ExternalActor doesn't exist."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="committer@example.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Create CommitAuthor with GitHub external_id
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="Test Committer",
            email="committer@example.com",
            external_id="github:githubuser",
        )

        username = get_github_username_for_user(user, organization.id)
        assert username == "githubuser"

    def test_get_github_username_for_user_from_commit_author_github_enterprise(self) -> None:
        """Tests getting GitHub Enterprise username from CommitAuthor."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="committer@company.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Create CommitAuthor with GitHub Enterprise external_id
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="Enterprise User",
            email="committer@company.com",
            external_id="github_enterprise:ghuser",
        )

        username = get_github_username_for_user(user, organization.id)
        assert username == "ghuser"

    @patch("sentry.seer.utils.metrics.incr")
    def test_get_github_username_for_user_records_resolution_source(
        self, mock_incr: MagicMock
    ) -> None:
        """Tests that each resolution outcome is counted with its source and referrer."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders
        from sentry.models.commitauthor import CommitAuthor

        organization = self.create_organization()

        mapped_user = self.create_user()
        ExternalActor.objects.create(
            user_id=mapped_user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@mapped",
            external_id="1",
            integration_id=1,
        )
        committer = self.create_user(email="committer@example.com")
        self.create_member(user=committer, organization=organization)
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="Committer",
            email="committer@example.com",
            external_id="github:committer",
        )
        unmapped_user = self.create_user()

        get_github_username_for_user(mapped_user, organization.id, referrer="pr_review_request")
        get_github_username_for_user(committer, organization.id, referrer="pr_review_request")
        get_github_username_for_user(unmapped_user, organization.id)

        # `sentry.seer.utils.metrics` is the shared metrics module, so the mock
        # also sees unrelated counters (e.g. lock bookkeeping); filter to ours.
        resolution_calls = [
            c
            for c in mock_incr.call_args_list
            if c.args and c.args[0] == "seer.github_username_for_user"
        ]
        assert resolution_calls == [
            call(
                "seer.github_username_for_user",
                tags={"source": "external_actor", "referrer": "pr_review_request"},
            ),
            call(
                "seer.github_username_for_user",
                tags={"source": "commit_author", "referrer": "pr_review_request"},
            ),
            call(
                "seer.github_username_for_user",
                tags={"source": "none", "referrer": "unknown"},
            ),
        ]

    def test_get_github_username_for_user_external_actor_priority(self) -> None:
        """Tests that ExternalActor is checked before CommitAuthor."""
        from sentry.integrations.models.external_actor import ExternalActor
        from sentry.integrations.types import ExternalProviders
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="committer@example.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Create both ExternalActor and CommitAuthor
        ExternalActor.objects.create(
            user_id=user.id,
            organization=organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@externaluser",
            external_id="ext123",
            integration_id=7,
        )

        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="Commit User",
            email="committer@example.com",
            external_id="github:commituser",
        )

        # Should use ExternalActor (higher priority)
        username = get_github_username_for_user(user, organization.id)
        assert username == "externaluser"

    def test_get_github_username_for_user_commit_author_no_external_id(self) -> None:
        """Tests that None is returned when CommitAuthor exists but has no external_id."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="committer@example.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Create CommitAuthor without external_id
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="No External ID",
            email="committer@example.com",
            external_id=None,
        )

        username = get_github_username_for_user(user, organization.id)
        assert username is None

    def test_get_github_username_for_user_wrong_organization(self) -> None:
        """Tests that CommitAuthor from different organization is not used."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="committer@example.com")
        organization1 = self.create_organization()
        organization2 = self.create_organization()
        self.create_member(user=user, organization=organization1)

        # Create CommitAuthor in different organization
        CommitAuthor.objects.create(
            organization_id=organization2.id,
            name="Wrong Org User",
            email="committer@example.com",
            external_id="github:wrongorguser",
        )

        username = get_github_username_for_user(user, organization1.id)
        assert username is None

    def test_get_github_username_for_user_unverified_email_not_matched(self) -> None:
        """Tests that unverified emails don't match CommitAuthor (security requirement)."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="verified@example.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Add an unverified email to the user
        self.create_useremail(user=user, email="unverified@example.com", is_verified=False)

        # Create CommitAuthor that matches the UNVERIFIED email
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="unverified",
            email="unverified@example.com",
            external_id="github:unverified",
        )

        # Should NOT match the unverified email (security fix)
        username = get_github_username_for_user(user, organization.id)
        assert username is None

    def test_get_github_username_for_user_verified_secondary_email_matched(self) -> None:
        """Tests that verified secondary emails DO match CommitAuthor."""
        from sentry.models.commitauthor import CommitAuthor

        user = self.create_user(email="primary@example.com")
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)

        # Add a verified secondary email
        self.create_useremail(user=user, email="secondary@example.com", is_verified=True)

        # Create CommitAuthor that matches the verified secondary email
        CommitAuthor.objects.create(
            organization_id=organization.id,
            name="Developer",
            email="secondary@example.com",
            external_id="github:developeruser",
        )

        # Should match the verified secondary email
        username = get_github_username_for_user(user, organization.id)
        assert username == "developeruser"
