from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime
from unittest.mock import patch

from snuba_sdk import Column, Condition, Op

from sentry.eventstore.models import GroupEvent
from sentry.issues.grouptype import PerformanceNPlusOneGroupType, ProfileFileIOGroupType
from sentry.models.group import Group
from sentry.testutils.cases import PerformanceIssueTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin


def _get_recommended_non_null(g: Group) -> GroupEvent:
    ret = g.get_recommended_event_for_environments()
    assert ret is not None
    return ret


def _get_latest_non_null(g: Group, environments: Sequence[str] = ()) -> GroupEvent:
    ret = g.get_latest_event_for_environments(environments)
    assert ret is not None
    return ret


def _get_oldest_non_null(g: Group, environments: Sequence[str] = ()) -> GroupEvent:
    ret = g.get_oldest_event_for_environments(environments)
    assert ret is not None
    return ret


class GroupTestSnuba(TestCase, SnubaTestCase, PerformanceIssueTestCase, OccurrenceTestMixin):
    def test_get_oldest_latest_for_environments(self):
        project = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "production",
                "timestamp": iso_format(before_now(minutes=3)),
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "timestamp": iso_format(before_now(minutes=2)),
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )

        group = Group.objects.get()

        assert _get_latest_non_null(group).event_id == "c" * 32
        assert group.get_latest_event_for_environments(["staging"]) is None
        assert _get_latest_non_null(group, ["production"]).event_id == "b" * 32
        assert _get_oldest_non_null(group).event_id == "a" * 32
        assert _get_oldest_non_null(group, ["staging", "production"]).event_id == "a" * 32
        assert group.get_oldest_event_for_environments(["staging"]) is None

    def test_error_issue_get_helpful_for_environments(self):
        project = self.create_project()
        replay_id = uuid.uuid4().hex

        event_all_helpful_params = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(minutes=3)),
                "fingerprint": ["group-1"],
                "contexts": {
                    "replay": {"replay_id": replay_id},
                    "trace": {
                        "sampled": True,
                        "span_id": "babaae0d4b7512d9",
                        "trace_id": "a7d67cf796774551a95be6543cacd459",
                    },
                },
                "errors": [],
            },
            project_id=project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(minutes=2)),
                "fingerprint": ["group-1"],
                "contexts": {
                    "replay": {"replay_id": replay_id},
                },
                "errors": [{"type": "one"}, {"type": "two"}],
            },
            project_id=project.id,
            assert_no_errors=False,
        )
        event_none_helpful_params = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )

        group = Group.objects.get()
        assert _get_recommended_non_null(group).event_id == event_all_helpful_params.event_id
        assert _get_latest_non_null(group).event_id == event_none_helpful_params.event_id
        assert _get_oldest_non_null(group).event_id == event_all_helpful_params.event_id

    @patch("sentry.quotas.backend.get_event_retention")
    def test_get_recommended_event_for_environments_retention_limit(self, mock_get_event_retention):
        """
        If last_seen is outside of the retention limit, falls back to the latest event behavior.
        """
        mock_get_event_retention.return_value = 90
        project = self.create_project()
        outside_retention_date = before_now(days=91)

        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(outside_retention_date),
                "fingerprint": ["group-1"],
                "contexts": {},
                "errors": [],
            },
            project_id=project.id,
            assert_no_errors=False,
        )

        group = Group.objects.get()
        group.last_seen = before_now(days=91)
        assert _get_recommended_non_null(group).event_id == event.event_id


def _get_recommended(
    g: Group,
    conditions: Sequence[Condition] | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> GroupEvent:
    ret = g.get_recommended_event(conditions=conditions, start=start, end=end)
    assert ret is not None
    return ret


def _get_latest(
    g: Group,
    conditions: Sequence[Condition] | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> GroupEvent:
    ret = g.get_latest_event(conditions=conditions, start=start, end=end)
    assert ret is not None
    return ret


def _get_oldest(
    g: Group,
    conditions: Sequence[Condition] | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> GroupEvent:
    ret = g.get_oldest_event(conditions=conditions, start=start, end=end)
    assert ret is not None
    return ret


@freeze_time()
class GroupTestSnubaErrorIssue(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.event_a = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "environment": "staging",
                "fingerprint": ["group-1"],
                "message": "Error: Division by zero",
            },
            project_id=self.project.id,
        )
        self.event_b = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(minutes=2)),
                "fingerprint": ["group-1"],
                "environment": "production",
                "contexts": {
                    "replay": {"replay_id": uuid.uuid4().hex},
                    "trace": {
                        "sampled": True,
                        "span_id": "babaae0d4b7512d9",
                        "trace_id": "a7d67cf796774551a95be6543cacd459",
                    },
                },
                "message": "Error: Division by zero",
            },
            project_id=self.project.id,
        )
        self.event_c = self.store_event(
            data={
                "event_id": "c" * 32,
                "timestamp": iso_format(before_now(minutes=3)),
                "fingerprint": ["group-1"],
                "tags": {"organization.slug": "sentry"},
                "environment": "staging",
                "contexts": {
                    "trace": {
                        "sampled": True,
                        "span_id": "babaae0d4b7512d9",
                        "trace_id": "a7d67cf796774551a95be6543cacd459",
                    },
                },
                "message": "Error: Division by zero",
            },
            project_id=self.project.id,
        )

        self.group: Group = Group.objects.get()
        assert isinstance(self.group, Group)

    def test_recommended_event(self):
        # No filter
        assert _get_recommended(self.group).event_id == self.event_b.event_id

        # Filter by environment
        conditions = [Condition(Column("environment"), Op.IN, ["staging"])]
        assert _get_recommended(self.group, conditions=conditions).event_id == self.event_c.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["production"])]
        assert _get_recommended(self.group, conditions=conditions).event_id == self.event_b.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["development"])]
        assert self.group.get_recommended_event(conditions=conditions) is None

        # Filter by query
        conditions = [Condition(Column("tags[organization.slug]"), Op.EQ, "sentry")]
        assert _get_recommended(self.group, conditions=conditions).event_id == self.event_c.event_id
        conditions = [Condition(Column("trace_id"), Op.IS_NULL)]
        assert _get_recommended(self.group, conditions=conditions).event_id == self.event_a.event_id

        # Filter by date range
        assert (
            _get_recommended(
                self.group, start=before_now(seconds=120), end=before_now(seconds=30)
            ).event_id
            == self.event_b.event_id
        )
        assert (
            _get_recommended(
                self.group, start=before_now(hours=1), end=before_now(seconds=90)
            ).event_id
            == self.event_b.event_id
        )

    def test_latest_event(self):
        # No filter
        assert _get_latest(self.group).event_id == self.event_a.event_id

        # Filter by environment
        conditions = [Condition(Column("environment"), Op.IN, ["staging"])]
        assert _get_latest(self.group, conditions=conditions).event_id == self.event_a.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["production"])]
        assert _get_latest(self.group, conditions=conditions).event_id == self.event_b.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["development"])]
        assert self.group.get_latest_event(conditions=conditions) is None

        # Filter by query
        conditions = [Condition(Column("tags[organization.slug]"), Op.EQ, "sentry")]
        assert _get_latest(self.group, conditions=conditions).event_id == self.event_c.event_id
        conditions = [Condition(Column("trace_id"), Op.IS_NULL)]
        assert _get_latest(self.group, conditions=conditions).event_id == self.event_a.event_id

        # Filter by date range
        assert (
            _get_latest(
                self.group, start=before_now(seconds=120), end=before_now(seconds=30)
            ).event_id
            == self.event_a.event_id
        )
        assert (
            _get_latest(self.group, start=before_now(hours=1), end=before_now(seconds=90)).event_id
            == self.event_b.event_id
        )

    def test_oldest_event(self):
        # No filter
        assert _get_oldest(self.group).event_id == self.event_c.event_id

        # Filter by environment
        conditions = [Condition(Column("environment"), Op.IN, ["staging"])]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.event_c.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["production"])]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.event_b.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["development"])]
        assert self.group.get_oldest_event(conditions=conditions) is None

        # Filter by query
        conditions = [Condition(Column("tags[organization.slug]"), Op.EQ, "sentry")]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.event_c.event_id
        conditions = [Condition(Column("trace_id"), Op.IS_NULL)]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.event_a.event_id

        # Filter by date range
        assert (
            _get_oldest(
                self.group, start=before_now(seconds=150), end=before_now(seconds=30)
            ).event_id
            == self.event_b.event_id
        )
        assert (
            _get_oldest(self.group, start=before_now(hours=1), end=before_now(seconds=90)).event_id
            == self.event_c.event_id
        )


@freeze_time()
class GroupTestSnubaPerformanceIssue(TestCase, SnubaTestCase, PerformanceIssueTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        group_fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-group1"

        event_data_a = load_data(
            "transaction-n-plus-one",
            fingerprint=[group_fingerprint],
            timestamp=before_now(minutes=1),
            start_timestamp=before_now(minutes=1, seconds=1),
            event_id="a" * 32,
        )
        event_data_a["environment"] = "staging"

        event_data_b = load_data(
            "transaction-n-plus-one",
            fingerprint=[group_fingerprint],
            timestamp=before_now(minutes=2),
            start_timestamp=before_now(minutes=2, seconds=1),
            event_id="b" * 32,
        )
        event_data_b["environment"] = "production"
        event_data_b["contexts"].update(
            {
                "replay": {"replay_id": uuid.uuid4().hex},
                "profile": {"profile_id": uuid.uuid4().hex},
            }
        )

        event_data_c = load_data(
            "transaction-n-plus-one",
            fingerprint=[group_fingerprint],
            timestamp=before_now(minutes=3),
            start_timestamp=before_now(minutes=3, seconds=1),
            event_id="c" * 32,
        )
        event_data_c["environment"] = "staging"
        event_data_c["contexts"].update({"profile": {"profile_id": uuid.uuid4().hex}})
        event_data_c["tags"] = {"organization.slug": "sentry"}

        self.event_a = self.create_performance_issue(
            event_data=event_data_a, fingerprint=group_fingerprint
        )
        self.event_b = self.create_performance_issue(
            event_data=event_data_b, fingerprint=group_fingerprint
        )
        self.event_c = self.create_performance_issue(
            event_data=event_data_c, fingerprint=group_fingerprint
        )

        self.group: Group = Group.objects.get()
        assert isinstance(self.group, Group)

    def test_recommended_event(self):
        # No filter
        assert _get_recommended(self.group).event_id == self.event_b.event_id

        # Filter by environment
        conditions = [Condition(Column("environment"), Op.IN, ["staging"])]
        assert _get_recommended(self.group, conditions=conditions).event_id == self.event_c.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["production"])]
        assert _get_recommended(self.group, conditions=conditions).event_id == self.event_b.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["development"])]
        assert self.group.get_recommended_event(conditions=conditions) is None

        # Filter by query
        conditions = [Condition(Column("tags[organization.slug]"), Op.EQ, "sentry")]
        assert _get_recommended(self.group, conditions=conditions).event_id == self.event_c.event_id
        conditions = [Condition(Column("profile_id"), Op.IS_NULL)]
        assert _get_recommended(self.group, conditions=conditions).event_id == self.event_a.event_id

        # Filter by date range
        assert (
            _get_recommended(
                self.group, start=before_now(seconds=120), end=before_now(seconds=30)
            ).event_id
            == self.event_b.event_id
        )
        assert (
            _get_recommended(
                self.group, start=before_now(hours=1), end=before_now(seconds=90)
            ).event_id
            == self.event_b.event_id
        )

    def test_latest_event(self):
        # No filter
        assert _get_latest(self.group).event_id == self.event_a.event_id

        # Filter by environment
        conditions = [Condition(Column("environment"), Op.IN, ["staging"])]
        assert _get_latest(self.group, conditions=conditions).event_id == self.event_a.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["production"])]
        assert _get_latest(self.group, conditions=conditions).event_id == self.event_b.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["development"])]
        assert self.group.get_latest_event(conditions=conditions) is None

        # Filter by query
        conditions = [Condition(Column("tags[organization.slug]"), Op.EQ, "sentry")]
        assert _get_latest(self.group, conditions=conditions).event_id == self.event_c.event_id
        conditions = [Condition(Column("profile_id"), Op.IS_NULL)]
        assert _get_latest(self.group, conditions=conditions).event_id == self.event_a.event_id

        # Filter by date range
        assert (
            _get_latest(
                self.group, start=before_now(seconds=120), end=before_now(seconds=30)
            ).event_id
            == self.event_a.event_id
        )
        assert (
            _get_latest(self.group, start=before_now(hours=1), end=before_now(seconds=90)).event_id
            == self.event_b.event_id
        )

    def test_oldest_event(self):
        # No filter
        assert _get_oldest(self.group).event_id == self.event_c.event_id

        # Filter by environment
        conditions = [Condition(Column("environment"), Op.IN, ["staging"])]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.event_c.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["production"])]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.event_b.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["development"])]
        assert self.group.get_oldest_event(conditions=conditions) is None

        # Filter by query
        conditions = [Condition(Column("tags[organization.slug]"), Op.EQ, "sentry")]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.event_c.event_id
        conditions = [Condition(Column("profile_id"), Op.IS_NULL)]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.event_a.event_id

        # Filter by date range
        assert (
            _get_oldest(
                self.group, start=before_now(seconds=150), end=before_now(seconds=30)
            ).event_id
            == self.event_b.event_id
        )
        assert (
            _get_oldest(self.group, start=before_now(hours=1), end=before_now(seconds=90)).event_id
            == self.event_c.event_id
        )


@freeze_time()
class GroupTestSnubaOccurrenceIssue(TestCase, SnubaTestCase, OccurrenceTestMixin):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()

        self.issue_occ_a, _ = self.process_occurrence(
            project_id=self.project.id,
            event_id="a" * 32,
            event_data={
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group-1"],
                "environment": "staging",
                "contexts": {
                    "profile": {"profile_id": uuid.uuid4().hex},
                },
            },
        )

        self.issue_occ_b, _ = self.process_occurrence(
            project_id=self.project.id,
            event_id="b" * 32,
            event_data={
                "timestamp": iso_format(before_now(minutes=2)),
                "fingerprint": ["group-1"],
                "environment": "production",
                "contexts": {
                    "profile": {"profile_id": uuid.uuid4().hex},
                    "replay": {"replay_id": uuid.uuid4().hex},
                    "trace": {
                        "sampled": True,
                        "span_id": "babaae0d4b7512d9",
                        "trace_id": "a7d67cf796774551a95be6543cacd459",
                    },
                },
            },
        )

        self.issue_occ_c, _ = self.process_occurrence(
            project_id=self.project.id,
            event_id="c" * 32,
            event_data={
                "timestamp": iso_format(before_now(minutes=3)),
                "fingerprint": ["group-1"],
                "environment": "staging",
                "tags": {"organization.slug": "sentry"},
                "contexts": {
                    "profile": {"profile_id": uuid.uuid4().hex},
                    "replay": {"replay_id": uuid.uuid4().hex},
                },
            },
        )

        self.group: Group = Group.objects.get()
        self.group.update(type=ProfileFileIOGroupType.type_id)
        assert isinstance(self.group, Group)
        assert self.group.type == ProfileFileIOGroupType.type_id

    def test_recommended_event(self):
        # No filter
        self.assert_occurrences_identical(_get_recommended(self.group).occurrence, self.issue_occ_b)

        # Filter by environment
        conditions = [Condition(Column("environment"), Op.IN, ["staging"])]
        assert (
            _get_recommended(self.group, conditions=conditions).event_id
            == self.issue_occ_c.event_id
        )
        conditions = [Condition(Column("environment"), Op.IN, ["production"])]
        assert (
            _get_recommended(self.group, conditions=conditions).event_id
            == self.issue_occ_b.event_id
        )
        conditions = [Condition(Column("environment"), Op.IN, ["development"])]
        assert self.group.get_recommended_event(conditions=conditions) is None

        # Filter by query
        conditions = [Condition(Column("tags[organization.slug]"), Op.EQ, "sentry")]
        assert (
            _get_recommended(self.group, conditions=conditions).event_id
            == self.issue_occ_c.event_id
        )
        conditions = [Condition(Column("replay_id"), Op.IS_NULL)]
        assert (
            _get_recommended(self.group, conditions=conditions).event_id
            == self.issue_occ_a.event_id
        )

        # Filter by date range
        assert (
            _get_recommended(
                self.group, start=before_now(seconds=150), end=before_now(seconds=30)
            ).event_id
            == self.issue_occ_b.event_id
        )
        assert (
            _get_recommended(
                self.group, start=before_now(hours=1), end=before_now(seconds=90)
            ).event_id
            == self.issue_occ_b.event_id
        )

    def test_latest_event(self):
        # No filter
        self.assert_occurrences_identical(_get_latest(self.group).occurrence, self.issue_occ_a)

        # Filter by environment
        conditions = [Condition(Column("environment"), Op.IN, ["staging"])]
        assert _get_latest(self.group, conditions=conditions).event_id == self.issue_occ_a.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["production"])]
        assert _get_latest(self.group, conditions=conditions).event_id == self.issue_occ_b.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["development"])]
        assert self.group.get_latest_event(conditions=conditions) is None

        # Filter by query
        conditions = [Condition(Column("tags[organization.slug]"), Op.EQ, "sentry")]
        assert _get_latest(self.group, conditions=conditions).event_id == self.issue_occ_c.event_id
        conditions = [Condition(Column("replay_id"), Op.IS_NULL)]
        assert _get_latest(self.group, conditions=conditions).event_id == self.issue_occ_a.event_id

        # Filter by date range
        assert (
            _get_latest(
                self.group, start=before_now(seconds=120), end=before_now(seconds=30)
            ).event_id
            == self.issue_occ_a.event_id
        )
        assert (
            _get_latest(self.group, start=before_now(hours=1), end=before_now(seconds=90)).event_id
            == self.issue_occ_b.event_id
        )

    def test_oldest_event(self):
        # No filter
        self.assert_occurrences_identical(_get_oldest(self.group).occurrence, self.issue_occ_c)

        # Filter by environment
        conditions = [Condition(Column("environment"), Op.IN, ["staging"])]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.issue_occ_c.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["production"])]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.issue_occ_b.event_id
        conditions = [Condition(Column("environment"), Op.IN, ["development"])]
        assert self.group.get_oldest_event(conditions=conditions) is None

        # Filter by query
        conditions = [Condition(Column("tags[organization.slug]"), Op.EQ, "sentry")]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.issue_occ_c.event_id
        conditions = [Condition(Column("replay_id"), Op.IS_NULL)]
        assert _get_oldest(self.group, conditions=conditions).event_id == self.issue_occ_a.event_id

        # Filter by date range
        assert (
            _get_oldest(
                self.group, start=before_now(seconds=150), end=before_now(seconds=30)
            ).event_id
            == self.issue_occ_b.event_id
        )
        assert (
            _get_oldest(self.group, start=before_now(hours=1), end=before_now(seconds=90)).event_id
            == self.issue_occ_c.event_id
        )
