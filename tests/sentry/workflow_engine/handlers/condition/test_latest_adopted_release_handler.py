from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest

from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.rules.filters.latest_adopted_release_filter import (
    LatestAdoptedReleaseFilter,
    get_first_last_release_for_group_cache_key,
)
from sentry.search.utils import LatestReleaseOrders
from sentry.testutils.skips import requires_snuba
from sentry.utils.cache import cache
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase

pytestmark = [requires_snuba, pytest.mark.sentry_metrics]


class TestLatestAdoptedReleaseCondition(ConditionTestCase):
    condition = Condition.LATEST_ADOPTED_RELEASE
    rule_cls = LatestAdoptedReleaseFilter
    payload = {
        "id": LatestAdoptedReleaseFilter.id,
        "oldest_or_newest": "oldest",
        "older_or_newer": "newer",
        "environment": "prod",
    }

    def setUp(self):
        super().setUp()
        self.now = datetime.now(UTC)
        self.prod_env = self.create_environment(name="prod")
        self.test_env = self.create_environment(name="test")
        self.newest_release = self.create_release(
            project=self.event.group.project,
            version="test@2.0",
            date_added=self.now - timedelta(days=2),
            environments=[self.test_env],
            adopted=self.now - timedelta(days=2),
        )

        self.oldest_release = self.create_release(
            project=self.event.group.project,
            version="test@1.0",
            date_added=self.now - timedelta(days=1),
            environments=[self.prod_env],
            adopted=self.now - timedelta(days=1),
        )

        self.middle_release = self.create_release(
            project=self.event.group.project,
            version="test@1.5",
            date_added=self.now,
            environments=[self.prod_env],
            adopted=self.now,
        )

        self.job = WorkflowJob(
            {
                "event": self.event,
            }
        )
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "oldest_or_newest": "oldest",
                "older_or_newer": "newer",
                "environment": self.prod_env.name,
            },
            condition_result=True,
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "oldest_or_newest": "oldest",
            "older_or_newer": "newer",
            "environment": "prod",
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_semver(self):
        # Test no release
        self.assert_does_not_pass(self.dc, self.job)

        self.create_group_release(group=self.event.group, release=self.newest_release)
        self.assert_passes(self.dc, WorkflowJob({"event": self.event}))

        event_2 = self.store_event(data={"fingerprint": ["group2"]}, project_id=self.project.id)
        group_2 = event_2.group

        self.create_group_release(group=group_2, release=self.newest_release)
        self.create_group_release(group=group_2, release=self.oldest_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": event_2}))

        event_3 = self.store_event(data={"fingerprint": ["group3"]}, project_id=self.project.id)
        group_3 = event_3.group

        self.create_group_release(group=group_3, release=self.middle_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": event_3}))

        # Check that the group cache invalidation works by adding an older release to the first group
        self.create_group_release(group=self.event.group, release=self.oldest_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": self.event}))

        # Check that the project cache invalidation works by adding a newer release to the project
        event_4 = self.store_event(data={"fingerprint": ["group4"]}, project_id=self.project.id)
        group_4 = event_4.group
        self.create_group_release(group=group_4, release=self.newest_release)
        self.assert_passes(self.dc, WorkflowJob({"event": event_4}))

        self.create_release(
            project=self.event.group.project,
            version="test@3.0",
            date_added=self.now - timedelta(days=5),
            environments=[self.prod_env],
            adopted=self.now - timedelta(days=2),
        )
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": event_4}))

    def test_date(self):
        self.create_group_release(group=self.event.group, release=self.newest_release)
        self.assert_passes(self.dc, WorkflowJob({"event": self.event}))

        event_2 = self.store_event(data={"fingerprint": ["group2"]}, project_id=self.project.id)
        group_2 = event_2.group

        self.create_group_release(group=group_2, release=self.newest_release)
        self.create_group_release(group=group_2, release=self.oldest_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": event_2}))

        event_3 = self.store_event(data={"fingerprint": ["group3"]}, project_id=self.project.id)
        group_3 = event_3.group

        self.create_group_release(group=group_3, release=self.middle_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": event_3}))

    def test_oldest_older(self):
        self.dc.update(
            comparison={
                "oldest_or_newest": "oldest",
                "older_or_newer": "older",
                "environment": self.prod_env.name,
            }
        )

        self.create_group_release(group=self.event.group, release=self.newest_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": self.event}))

        event_2 = self.store_event(data={"fingerprint": ["group2"]}, project_id=self.project.id)
        group_2 = event_2.group

        self.create_group_release(group=group_2, release=self.newest_release)
        self.create_group_release(group=group_2, release=self.oldest_release)
        self.assert_passes(self.dc, WorkflowJob({"event": event_2}))

        event_3 = self.store_event(data={"fingerprint": ["group3"]}, project_id=self.project.id)
        group_3 = event_3.group

        self.create_group_release(group=group_3, release=self.middle_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": event_3}))

    def test_newest_newer(self):
        self.dc.update(
            comparison={
                "oldest_or_newest": "newest",
                "older_or_newer": "newer",
                "environment": self.prod_env.name,
            }
        )

        self.create_group_release(group=self.event.group, release=self.newest_release)
        self.assert_passes(self.dc, WorkflowJob({"event": self.event}))

        event_2 = self.store_event(data={"fingerprint": ["group2"]}, project_id=self.project.id)
        group_2 = event_2.group

        self.create_group_release(group=group_2, release=self.newest_release)
        self.create_group_release(group=group_2, release=self.oldest_release)
        self.assert_passes(self.dc, WorkflowJob({"event": event_2}))

        event_3 = self.store_event(data={"fingerprint": ["group3"]}, project_id=self.project.id)
        group_3 = event_3.group

        self.create_group_release(group=group_3, release=self.middle_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": event_3}))

    def test_newest_older(self):
        self.dc.update(
            comparison={
                "oldest_or_newest": "newest",
                "older_or_newer": "older",
                "environment": self.prod_env.name,
            }
        )

        self.create_group_release(group=self.event.group, release=self.newest_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": self.event}))

        event_2 = self.store_event(data={"fingerprint": ["group2"]}, project_id=self.project.id)
        group_2 = event_2.group

        self.create_group_release(group=group_2, release=self.newest_release)
        self.create_group_release(group=group_2, release=self.oldest_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": event_2}))

        event_3 = self.store_event(data={"fingerprint": ["group3"]}, project_id=self.project.id)
        group_3 = event_3.group

        self.create_group_release(group=group_3, release=self.middle_release)
        self.assert_does_not_pass(self.dc, WorkflowJob({"event": event_3}))

    def test_caching(self):
        cache_key = get_first_last_release_for_group_cache_key(
            self.event.group.id, "oldest", LatestReleaseOrders.SEMVER
        )
        assert cache.get(cache_key) is None

        self.create_group_release(group=self.event.group, release=self.newest_release)
        self.assert_passes(self.dc, self.job)
        assert cache.get(cache_key) is not None

        # ensure we clear the cache after creating a new release
        oldest_group_release = self.create_group_release(
            group=self.event.group, release=self.oldest_release
        )
        assert cache.get(cache_key) is None

        self.assert_does_not_pass(self.dc, self.job)
        assert cache.get(cache_key) is not None

        # ensure we clear the cache when a release is deleted
        oldest_group_release.delete()
        assert cache.get(cache_key) is None

        self.assert_passes(self.dc, self.job)

    def test_release_does_not_exist(self):
        with patch(
            "sentry.search.utils.get_first_last_release_for_group", side_effect=Release.DoesNotExist
        ):
            self.assert_does_not_pass(self.dc, self.job)

        with patch(
            "sentry.workflow_engine.handlers.condition.latest_release_handler.get_latest_release_for_env",
            return_value=None,
        ):
            self.assert_does_not_pass(self.dc, self.job)

        with patch(
            "sentry.workflow_engine.handlers.condition.latest_adopted_release_handler.get_first_last_release_for_env",
            return_value=None,
        ):
            self.assert_does_not_pass(self.dc, self.job)

    def test_environment_does_not_exist(self):
        with patch("sentry.models.environment.Environment.get_for_organization_id") as mock_get_env:
            mock_get_env.side_effect = Environment.DoesNotExist
            self.assert_does_not_pass(self.dc, self.job)
