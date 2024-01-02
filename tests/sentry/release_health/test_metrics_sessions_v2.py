from datetime import timedelta
from typing import List

import pytest
from django.urls import reverse
from django.utils import timezone
from snuba_sdk import Column, Condition, Function, Op

from sentry.exceptions import InvalidParams
from sentry.release_health.metrics_sessions_v2 import (
    SessionStatus,
    _extract_status_filter_from_conditions,
)
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import freeze_time

pytestmark = pytest.mark.sentry_metrics

ONE_DAY_AGO = timezone.now() - timedelta(days=1)
MOCK_DATETIME = ONE_DAY_AGO.replace(hour=10, minute=0, second=0, microsecond=0)


@freeze_time(MOCK_DATETIME)
class MetricsSessionsV2Test(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.setup_fixture()

    def setup_fixture(self):
        self.organization1 = self.organization
        self.project1 = self.project
        self.project2 = self.create_project(
            name="teletubbies", slug="teletubbies", teams=[self.team], fire_project_created=True
        )

        self.release1 = self.create_release(project=self.project1, version="hello")
        self.release2 = self.create_release(project=self.project1, version="hola")
        self.release3 = self.create_release(project=self.project2, version="hallo")

        self.environment1 = self.create_environment(self.project1, name="development")
        self.environment2 = self.create_environment(self.project1, name="production")
        self.environment3 = self.create_environment(self.project2, name="testing")

    def do_request(self, query, user=None, org=None):
        self.login_as(user=user or self.user)
        url = reverse(
            "sentry-api-0-organization-sessions",
            kwargs={"organization_slug": (org or self.organization1).slug},
        )
        return self.client.get(url, query, format="json")

    def get_sessions_data(self, groupby: List[str], interval):
        response = self.do_request(
            {
                "organization_slug": [self.organization1],
                "project": [self.project1.id],
                "field": ["sum(session)"],
                "groupBy": groupby,
                "interval": interval,
            }
        )
        assert response.status_code == 200
        return response.data

    def test_sessions_metrics_with_metrics_only_field(self):
        """
        Tests whether the request of a metrics-only field forwarded to the SessionsReleaseHealthBackend
        is handled with an empty response.

        This test is designed to show an edge-case that can happen in case the duplexer makes the wrong
        decision with respect to which backend to choose for satisfying the query.
        """
        response = self.do_request(
            {
                "organization_slug": [self.organization1],
                "project": [self.project1.id],
                "field": ["crash_free_rate(session)"],
                "groupBy": [],
                "interval": "1d",
            }
        )

        assert len(response.data["groups"]) == 0
        assert response.status_code == 200


@pytest.mark.parametrize(
    "input, expected_output, expected_status_filter",
    [
        (
            [
                Condition(Column("release"), Op.EQ, "foo"),
                Condition(Column("session.status"), Op.IN, ["abnormal", "errored"]),
            ],
            [Condition(Column("release"), Op.EQ, "foo")],
            {SessionStatus.ABNORMAL, SessionStatus.ERRORED},
        ),
        (
            [
                Condition(Column("release"), Op.EQ, "foo"),
                Condition(Column("session.status"), Op.EQ, "bogus"),
            ],
            [Condition(Column("release"), Op.EQ, "foo")],
            frozenset(),
        ),
        (
            [
                Condition(Column("release"), Op.EQ, "foo"),
                Condition(Column("session.status"), Op.NEQ, "abnormal"),
            ],
            [Condition(Column("release"), Op.EQ, "foo")],
            {SessionStatus.HEALTHY, SessionStatus.ERRORED, SessionStatus.CRASHED},
        ),
        (
            [
                Condition(Column("release"), Op.EQ, "foo"),
                Condition(Column("session.status"), Op.NOT_IN, ["abnormal", "bogus"]),
            ],
            [Condition(Column("release"), Op.EQ, "foo")],
            {SessionStatus.HEALTHY, SessionStatus.ERRORED, SessionStatus.CRASHED},
        ),
        (
            [
                Condition(Column("session.status"), Op.EQ, "abnormal"),
                Condition(Column("session.status"), Op.EQ, "errored"),
            ],
            [],
            frozenset(),
        ),
    ],
)
def test_transform_conditions(input, expected_output, expected_status_filter):
    output, status_filter = _extract_status_filter_from_conditions(input)
    assert output == expected_output
    assert status_filter == expected_status_filter


@pytest.mark.parametrize("input", [[Condition(Column("release"), Op.EQ, "foo")]])
def test_transform_conditions_nochange(input):
    output, status_filter = _extract_status_filter_from_conditions(input)
    assert input == output
    assert status_filter is None


@pytest.mark.parametrize(
    "input",
    [
        [
            Condition(
                Function(
                    "or",
                    [
                        Function("equals", ["release", "foo"]),
                        Function("equals", ["session.status", "foo"]),
                    ],
                ),
                Op.EQ,
                1,
            )
        ],
    ],
)
def test_transform_conditions_illegal(input):
    pytest.raises(InvalidParams, _extract_status_filter_from_conditions, input)
