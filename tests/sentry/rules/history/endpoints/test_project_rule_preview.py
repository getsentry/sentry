from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.models import Group
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@freeze_time()
@region_silo_test
class ProjectRulePreviewEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-preview"

    def setUp(self):
        self.login_as(self.user)

    def test(self):
        Group.objects.create(project=self.project, first_seen=timezone.now() - timedelta(hours=1))
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            conditions=[{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}],
            filters=[],
            actionMatch="any",
            filterMatch="all",
            frequency=10,
        )
        assert resp.data[-1]["count"] == 1

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
        # No filters are currently supported
        invalid_filter = [{"id": "anything"}]
        condition = [{"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}]
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
