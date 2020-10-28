from __future__ import absolute_import

import functools
from datetime import datetime, timedelta

from sentry.utils.compat import mock
import pytest
import pytz
import copy
from django.core import mail
from django.utils import timezone

from sentry.app import tsdb
from sentry.models import Project, UserOption, GroupStatus
from sentry.tasks.reports import (
    DISABLED_ORGANIZATIONS_USER_OPTION_KEY,
    Report,
    Skipped,
    change,
    clean_series,
    colorize,
    deliver_organization_user_report,
    get_calendar_range,
    get_percentile,
    has_valid_aggregates,
    index_to_month,
    merge_mappings,
    merge_sequences,
    merge_series,
    month_to_index,
    prepare_reports,
    safe_add,
    user_subscribed_to_organization_reports,
    prepare_project_issue_summaries,
    prepare_project_series,
)
from sentry.testutils.cases import TestCase, SnubaTestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.utils.dates import to_datetime, to_timestamp, floor_to_utc_day
from sentry.testutils.helpers.datetime import iso_format

from sentry.utils.compat import map


@pytest.yield_fixture(scope="module")
def interval():
    stop = datetime(2016, 9, 12, tzinfo=pytz.utc)
    yield stop - timedelta(days=7), stop


def test_change():
    assert change(1, 0) is None
    assert change(10, 5) == 1.00  # 100% increase
    assert change(50, 100) == -0.50  # 50% decrease
    assert change(None, 100) == -1.00  # 100% decrease
    assert change(50, None) is None


def test_safe_add():
    assert safe_add(1, 1) == 2
    assert safe_add(None, 1) == 1
    assert safe_add(1, None) == 1
    assert safe_add(None, None) is None


def test_merge_mappings():
    assert merge_mappings({"a": 1, "b": 2, "c": 3}, {"a": 0, "b": 1, "c": 2}) == {
        "a": 1,
        "b": 3,
        "c": 5,
    }


def test_merge_mappings_custom_operator():
    assert merge_mappings(
        {"a": {"x": 1, "y": 1}, "b": {"x": 2, "y": 2}},
        {"a": {"x": 1, "y": 1}, "b": {"x": 2, "y": 2}},
        lambda left, right: merge_mappings(left, right),
    ) == {"a": {"x": 2, "y": 2}, "b": {"x": 4, "y": 4}}


def test_merge_mapping_different_keys():
    with pytest.raises(AssertionError):
        merge_mappings({"a": 1}, {"b": 2})


def test_merge_sequences():
    assert merge_sequences(range(0, 4), range(0, 4)) == [i * 2 for i in range(0, 4)]


def test_merge_sequences_custom_operator():
    assert merge_sequences(
        [{chr(65 + i): i} for i in range(0, 26)],
        [{chr(65 + i): i} for i in range(0, 26)],
        merge_mappings,
    ) == [{chr(65 + i): i * 2} for i in range(0, 26)]


def test_merge_series():
    assert merge_series([(i, i) for i in range(0, 10)], [(i, i) for i in range(0, 10)]) == [
        (i, i * 2) for i in range(0, 10)
    ]


def test_merge_series_custom_operator():
    assert merge_series(
        [(i, {chr(65 + i): i}) for i in range(0, 26)],
        [(i, {chr(65 + i): i}) for i in range(0, 26)],
        merge_mappings,
    ) == [(i, {chr(65 + i): i * 2}) for i in range(0, 26)]


def test_merge_series_offset_timestamps():
    with pytest.raises(AssertionError):
        merge_series([(i, i) for i in range(0, 10)], [(i + 1, i) for i in range(0, 10)])


def test_merge_series_different_lengths():
    with pytest.raises(AssertionError):
        merge_series([(i, i) for i in range(0, 1)], [(i, i) for i in range(0, 10)])

    with pytest.raises(AssertionError):
        merge_series([(i, i) for i in range(0, 10)], [(i, i) for i in range(0, 1)])


def test_clean_series():
    rollup = 60
    n = 5
    start = to_datetime(rollup * 0)
    stop = to_datetime(rollup * n)
    series = [(rollup * i, i) for i in range(0, n)]
    assert clean_series(start, stop, rollup, series) == series


def test_clean_series_trims_extra():
    rollup = 60
    n = 5
    start = to_datetime(rollup * 0)
    stop = to_datetime(rollup * n)
    series = [(rollup * i, i) for i in range(0, n + 1)]
    assert clean_series(start, stop, rollup, series) == series[:n]


def test_clean_series_rejects_offset_timestamp():
    rollup = 60
    n = 5
    start = to_datetime(rollup * 0)
    stop = to_datetime(rollup * n)
    series = [(rollup * (i * 1.1), i) for i in range(0, n)]
    with pytest.raises(AssertionError):
        clean_series(start, stop, rollup, series)


def test_has_valid_aggregates(interval):
    project = None  # parameter is unused

    def make_report(aggregates):
        return Report(None, aggregates, None, None, None)

    assert has_valid_aggregates(interval, (project, make_report([None] * 4))) is False

    assert has_valid_aggregates(interval, (project, make_report([0] * 4))) is False

    assert has_valid_aggregates(interval, (project, make_report([1, 0, 0, 0]))) is True


def test_percentiles():
    values = [3, 6, 7, 8, 8, 9, 10, 13, 15, 16, 20]

    get_percentile([], 0.25) == 0
    get_percentile([], 1) == 0
    get_percentile(values, 0.25) == 7
    get_percentile(values, 0.50) == 9
    get_percentile(values, 0.75) == 15
    get_percentile(values, 1.00) == 20


def test_colorize():
    colors = ["green", "yellow", "red"]
    values = [2, 5, 1, 3, 4, 0]

    legend, results = colorize(colors, values)

    assert results == [
        (2, "yellow"),
        (5, "red"),
        (1, "green"),
        (3, "yellow"),
        (4, "red"),
        (0, "green"),
    ]

    legend, results = colorize(colors, [])
    assert results == []


def test_month_indexing():
    assert index_to_month(month_to_index(1986, 10)) == (1986, 10)


def test_calendar_range():
    assert get_calendar_range((None, datetime(2016, 2, 1, tzinfo=pytz.utc)), months=3) == (
        month_to_index(2015, 11),
        month_to_index(2016, 1),
    )


class ReportTestCase(TestCase, SnubaTestCase):
    def test_integration(self):
        Project.objects.all().delete()

        now = datetime(2016, 9, 12, tzinfo=pytz.utc)

        project = self.create_project(
            organization=self.organization, teams=[self.team], date_added=now - timedelta(days=90)
        )

        tsdb.incr(tsdb.models.project, project.id, now - timedelta(days=1))

        member_set = set(project.teams.first().member_set.all())

        with self.tasks(), mock.patch.object(
            tsdb, "get_earliest_timestamp"
        ) as get_earliest_timestamp:
            # Ensure ``get_earliest_timestamp`` is relative to the fixed
            # "current" timestamp -- this prevents filtering out data points
            # that would be considered expired relative to the *actual* current
            # timestamp.
            get_earliest_timestamp.return_value = to_timestamp(now - timedelta(days=60))

            prepare_reports(timestamp=to_timestamp(now))
            assert len(mail.outbox) == len(member_set) == 1

            message = mail.outbox[0]
            assert self.organization.name in message.subject

    def test_deliver_organization_user_report_respects_settings(self):
        user = self.user
        organization = self.organization

        set_option_value = functools.partial(
            UserOption.objects.set_value, user, DISABLED_ORGANIZATIONS_USER_OPTION_KEY
        )

        deliver_report = functools.partial(
            deliver_organization_user_report, 0, 60 * 60 * 24 * 7, organization.id, user.id
        )

        set_option_value([])
        assert deliver_report() is not Skipped.NotSubscribed

        set_option_value([organization.id])
        assert deliver_report() is Skipped.NotSubscribed

    def test_user_subscribed_to_organization_reports(self):
        user = self.user
        organization = self.organization

        set_option_value = functools.partial(
            UserOption.objects.set_value, user, DISABLED_ORGANIZATIONS_USER_OPTION_KEY
        )

        set_option_value([])
        assert user_subscribed_to_organization_reports(user, organization) is True

        set_option_value([-1])
        assert user_subscribed_to_organization_reports(user, organization) is True

        set_option_value([organization.id])
        assert user_subscribed_to_organization_reports(user, organization) is False

    @mock.patch("sentry.tasks.reports.BATCH_SIZE", 1)
    def test_paginates_project_issue_summaries_and_reassembles_result(self):
        self.login_as(user=self.user)

        now = timezone.now()
        min_ago = iso_format(now - timedelta(minutes=1))
        two_min_ago = now - timedelta(minutes=2)

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )

        assert prepare_project_issue_summaries([two_min_ago, now], self.project) == [2, 0, 0]

    @mock.patch("sentry.tasks.reports.BATCH_SIZE", 1)
    def test_paginates_project_series_and_reassembles_result(self):
        self.login_as(user=self.user)

        now = timezone.now()
        two_days_ago = now - timedelta(days=2)
        three_days_ago = iso_format(now - timedelta(days=3))
        seven_days_back = now - timedelta(days=7)

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": three_days_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )

        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": three_days_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )

        group1 = event1.group
        group2 = event2.group

        group1.status = GroupStatus.RESOLVED
        group1.resolved_at = two_days_ago
        group1.save()

        group2.status = GroupStatus.RESOLVED
        group2.resolved_at = two_days_ago
        group2.save()

        response = prepare_project_series(
            [floor_to_utc_day(seven_days_back), floor_to_utc_day(now)], self.project
        )

        assert any(
            map(lambda x: x[1] == (2, 0), response)
        ), "must show two issues resolved in one rollup window"
