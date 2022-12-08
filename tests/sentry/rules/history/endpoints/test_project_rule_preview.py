from datetime import timedelta

from dateutil.parser import parse as parse_datetime
from django.utils import timezone
from freezegun import freeze_time

from sentry.models import Activity, Group, GroupInbox, GroupInboxReason
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType


@freeze_time()
@region_silo_test
class ProjectRulePreviewEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-preview"
    method = "post"

    def setUp(self):
        self.login_as(self.user)
        self.features = ["organizations:issue-alert-preview"]

    def test(self):
        group = Group.objects.create(
            project=self.project,
            first_seen=timezone.now() - timedelta(hours=1),
            data={"metadata": {"title": "title"}},
        )
        with self.feature(self.features):
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                conditions=[
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
                ],
                filters=[],
                actionMatch="any",
                filterMatch="all",
                frequency=10,
            )
        assert len(resp.data) == 1
        assert resp.data[0]["id"] == str(group.id)

    def test_invalid_conditions(self):
        conditions = [
            [],
            [{"id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition"}],
        ]
        with self.feature(self.features):
            for invalid_condition in conditions:
                resp = self.get_response(
                    self.organization.slug,
                    self.project.slug,
                    conditions=invalid_condition,
                    filters=[],
                    actionMatch="any",
                    filterMatch="all",
                    frequency=10,
                )
                assert resp.status_code == 400

    def test_invalid_filters(self):
        invalid_filter = [{"id": "sentry.rules.filters.latest_release.LatestReleaseFilter"}]
        condition = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
        Group.objects.create(project=self.project, first_seen=timezone.now() - timedelta(hours=1))
        with self.feature(self.features):
            resp = self.get_response(
                self.organization.slug,
                self.project.slug,
                conditions=condition,
                filters=invalid_filter,
                actionMatch="any",
                filterMatch="all",
                frequency=10,
            )
        assert resp.status_code == 400

    def test_endpoint(self):
        with freeze_time(timezone.now()) as frozen_time:
            with self.feature(self.features):
                resp = self.get_success_response(
                    self.organization.slug,
                    self.project.slug,
                    conditions=[
                        {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
                    ],
                    filters=[],
                    actionMatch="any",
                    filterMatch="all",
                    frequency=10,
                    endpoint=None,
                )

            result = parse_datetime(resp["endpoint"])
            endpoint = frozen_time.time_to_freeze.replace(tzinfo=result.tzinfo)
            assert result == endpoint
            frozen_time.tick(1)

            with self.feature(self.features):
                resp = self.get_success_response(
                    self.organization.slug,
                    self.project.slug,
                    conditions=[
                        {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
                    ],
                    filters=[],
                    actionMatch="any",
                    filterMatch="all",
                    frequency=10,
                    endpoint=endpoint,
                )

            assert parse_datetime(resp["endpoint"]) == endpoint

    def test_inbox_reason(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        group_reason = []
        for reason in GroupInboxReason:
            group = Group.objects.create(
                project=self.project, first_seen=prev_hour, data={"metadata": {"title": "title"}}
            )
            GroupInbox.objects.create(group=group, project=self.project, reason=reason.value)
            group_reason.append((group, reason))

        with self.feature(self.features):
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                conditions=[
                    {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
                ],
                filters=[],
                actionMatch="any",
                filterMatch="all",
                frequency=10,
            )

            for (group, reason) in group_reason:
                assert any([int(g["id"]) == group.id for g in resp.data])

                for preview_group in resp.data:
                    if int(preview_group["id"]) == group.id:
                        assert preview_group["inbox"]["reason"] == reason.value
                        break

    def test_last_triggered(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        prev_two_hour = timezone.now() - timedelta(hours=2)
        for time in (prev_hour, prev_two_hour):
            Activity.objects.create(
                project=self.project,
                group=self.group,
                type=ActivityType.SET_REGRESSION.value,
                datetime=time,
            )

        with self.feature(self.features):
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                conditions=[
                    {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"}
                ],
                filters=[],
                actionMatch="any",
                filterMatch="all",
                frequency=60,
            )
            assert resp.data[0]["lastTriggered"] == prev_hour

            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                conditions=[
                    {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"}
                ],
                filters=[],
                actionMatch="any",
                filterMatch="all",
                frequency=180,
            )
            assert resp.data[0]["lastTriggered"] == prev_two_hour
