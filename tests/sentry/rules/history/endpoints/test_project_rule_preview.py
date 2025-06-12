from datetime import datetime, timedelta

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupinbox import GroupInbox, GroupInboxReason
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


@freeze_time()
class ProjectRulePreviewEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-preview"
    method = "post"

    def setUp(self):
        self.login_as(self.user)

    def test(self):
        group = Group.objects.create(
            project=self.project,
            first_seen=timezone.now() - timedelta(hours=1),
            data={"metadata": {"title": "title"}},
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            conditions=[{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}],
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
        time_to_freeze = timezone.now()
        with freeze_time(time_to_freeze) as frozen_time:
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

            result = datetime.fromisoformat(resp["endpoint"])
            endpoint = time_to_freeze.replace(tzinfo=result.tzinfo)
            assert result == endpoint
            frozen_time.shift(1)

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

            assert datetime.fromisoformat(resp["endpoint"]) == endpoint

    def test_inbox_reason(self):
        prev_hour = timezone.now() - timedelta(hours=1)
        group_reason = []
        for reason in GroupInboxReason:
            group = Group.objects.create(
                project=self.project, first_seen=prev_hour, data={"metadata": {"title": "title"}}
            )
            GroupInbox.objects.create(group=group, project=self.project, reason=reason.value)
            group_reason.append((group, reason))

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            conditions=[{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}],
            filters=[],
            actionMatch="any",
            filterMatch="all",
            frequency=10,
        )

        for group, reason in group_reason:
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
