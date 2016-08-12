from __future__ import absolute_import

import functools

import mock
import pytest
from django.core import mail

from sentry.models import Project, UserOption
from sentry.tasks.reports import (
    DISABLED_ORGANIZATIONS_USER_OPTION_KEY, Skipped, change, clean_series,
    deliver_organization_user_report, merge_mappings, merge_sequences,
    merge_series, prepare_reports, safe_add,
    user_subscribed_to_organization_reports
)
from sentry.testutils.cases import TestCase
from sentry.utils.dates import to_datetime


def test_change():
    assert change(1, 0) is None
    assert change(10, 5) == 1.00  # 100% increase
    assert change(50, 100) == -0.50   # 50% decrease
    assert change(None, 100) == -1.00  # 100% decrease
    assert change(50, None) is None


def test_safe_add():
    assert safe_add(1, 1) == 2
    assert safe_add(None, 1) == 1
    assert safe_add(1, None) == 1
    assert safe_add(None, None) is None


def test_merge_mappings():
    assert merge_mappings(
        {'a': 1, 'b': 2, 'c': 3},
        {'a': 0, 'b': 1, 'c': 2},
    ) == {'a': 1, 'b': 3, 'c': 5}


def test_merge_mappings_custom_operator():
    assert merge_mappings(
        {
            'a': {'x': 1, 'y': 1},
            'b': {'x': 2, 'y': 2},
        },
        {
            'a': {'x': 1, 'y': 1},
            'b': {'x': 2, 'y': 2},
        },
        lambda left, right: merge_mappings(left, right),
    ) == {
        'a': {'x': 2, 'y': 2},
        'b': {'x': 4, 'y': 4},
    }


def test_merge_mapping_different_keys():
    with pytest.raises(AssertionError):
        merge_mappings({'a': 1}, {'b': 2})


def test_merge_sequences():
    assert merge_sequences(
        range(0, 4),
        range(0, 4),
    ) == [i * 2 for i in xrange(0, 4)]


def test_merge_sequences_custom_operator():
    assert merge_sequences(
        [{chr(65 + i): i} for i in xrange(0, 26)],
        [{chr(65 + i): i} for i in xrange(0, 26)],
        merge_mappings,
    ) == [{chr(65 + i): i * 2} for i in xrange(0, 26)]


def test_merge_series():
    assert merge_series(
        [(i, i) for i in xrange(0, 10)],
        [(i, i) for i in xrange(0, 10)],
    ) == [(i, i * 2) for i in xrange(0, 10)]


def test_merge_series_custom_operator():
    assert merge_series(
        [(i, {chr(65 + i): i}) for i in xrange(0, 26)],
        [(i, {chr(65 + i): i}) for i in xrange(0, 26)],
        merge_mappings,
    ) == [(i, {chr(65 + i): i * 2}) for i in xrange(0, 26)]


def test_merge_series_offset_timestamps():
    with pytest.raises(AssertionError):
        merge_series(
            [(i, i) for i in xrange(0, 10)],
            [(i + 1, i) for i in xrange(0, 10)],
        )


def test_merge_series_different_lengths():
    with pytest.raises(AssertionError):
        merge_series(
            [(i, i) for i in xrange(0, 1)],
            [(i, i) for i in xrange(0, 10)],
        )

    with pytest.raises(AssertionError):
        merge_series(
            [(i, i) for i in xrange(0, 10)],
            [(i, i) for i in xrange(0, 1)],
        )


def test_clean_series():
    rollup = 60
    n = 5
    start = to_datetime(rollup * 0)
    stop = to_datetime(rollup * n)
    series = [(rollup * i, i) for i in xrange(0, n)]
    assert clean_series(
        start,
        stop,
        rollup,
        series,
    ) == series


def test_clean_series_trims_extra():
    rollup = 60
    n = 5
    start = to_datetime(rollup * 0)
    stop = to_datetime(rollup * n)
    series = [(rollup * i, i) for i in xrange(0, n + 1)]
    assert clean_series(
        start,
        stop,
        rollup,
        series,
    ) == series[:n]


def test_clean_series_rejects_offset_timestamp():
    rollup = 60
    n = 5
    start = to_datetime(rollup * 0)
    stop = to_datetime(rollup * n)
    series = [(rollup * (i * 1.1), i) for i in xrange(0, n)]
    with pytest.raises(AssertionError):
        clean_series(
            start,
            stop,
            rollup,
            series,
        )


class ReportTestCase(TestCase):
    @mock.patch('sentry.features.has')
    def test_integration(self, has_feature):
        Project.objects.all().delete()

        has_feature.side_effect = lambda name, *a, **k: {
            'organizations:reports:deliver': True,
            'organizations:reports:prepare': True,
        }.get(name, False)

        project = self.create_project(
            organization=self.organization,
            team=self.team,
        )

        member_set = set(project.team.member_set.all())

        with self.tasks():
            prepare_reports()
            assert len(mail.outbox) == len(member_set) == 1

            message = mail.outbox[0]
            assert self.organization.name in message.subject

    def test_deliver_organization_user_report_respects_settings(self):
        user = self.user
        organization = self.organization

        set_option_value = functools.partial(
            UserOption.objects.set_value,
            user,
            None,
            DISABLED_ORGANIZATIONS_USER_OPTION_KEY,
        )

        deliver_report = functools.partial(
            deliver_organization_user_report,
            0,
            60 * 60 * 24 * 7,
            organization.id,
            user.id,
        )

        set_option_value([])
        assert deliver_report() is not Skipped.NotSubscribed

        set_option_value([organization.id])
        assert deliver_report() is Skipped.NotSubscribed

    def test_user_subscribed_to_organization_reports(self):
        user = self.user
        organization = self.organization

        set_option_value = functools.partial(
            UserOption.objects.set_value,
            user,
            None,
            DISABLED_ORGANIZATIONS_USER_OPTION_KEY,
        )

        set_option_value([])
        assert user_subscribed_to_organization_reports(user, organization) is True

        set_option_value([-1])
        assert user_subscribed_to_organization_reports(user, organization) is True

        set_option_value([organization.id])
        assert user_subscribed_to_organization_reports(user, organization) is False
