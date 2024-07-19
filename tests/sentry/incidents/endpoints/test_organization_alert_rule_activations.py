from datetime import timedelta
from functools import cached_property

import pytest
from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.alert_rule_activations import (
    AlertRuleActivationsSerializer,
)
from sentry.incidents.models.alert_rule import AlertRuleMonitorTypeInt
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.skips import requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


class AlertRuleActivationsBase(APITestCase):
    __test__ = Abstract(__module__, __qualname__)

    endpoint = "sentry-api-0-organization-alert-rule-activations"

    def setUp(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

    @cached_property
    def organization(self):
        return self.create_organization()

    @cached_property
    def project(self):
        return self.create_project(organization=self.organization)

    @cached_property
    def user(self):
        return self.create_user()


class AlertRuleActivationsListEndpointTest(AlertRuleActivationsBase):
    def test_simple(self):
        alert_rule = self.create_alert_rule(monitor_type=AlertRuleMonitorTypeInt.CONTINUOUS)
        activation = self.create_alert_rule_activation(
            alert_rule=alert_rule, monitor_type=AlertRuleMonitorTypeInt.CONTINUOUS
        )
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, alert_rule.id)

        assert resp.data == serialize(activation, serializer=AlertRuleActivationsSerializer())

    def test_no_feature(self):
        alert_rule = self.create_alert_rule()
        resp = self.get_response(self.organization.slug, alert_rule.id)
        assert resp.status_code == 404

    def test_filter_by_start_end(self):
        alert_rule = self.create_alert_rule(monitor_type=AlertRuleMonitorTypeInt.CONTINUOUS)
        now = timezone.now()
        yesterday = now - timedelta(days=1)
        last_week = now - timedelta(days=7)
        with freeze_time(last_week):
            old_activation = self.create_alert_rule_activation(
                alert_rule=alert_rule, monitor_type=AlertRuleMonitorTypeInt.CONTINUOUS
            )

        with freeze_time(yesterday):
            yesterday_activation = self.create_alert_rule_activation(
                alert_rule=alert_rule, monitor_type=AlertRuleMonitorTypeInt.CONTINUOUS
            )

        with freeze_time(now):
            new_activation = self.create_alert_rule_activation(
                alert_rule=alert_rule, monitor_type=AlertRuleMonitorTypeInt.CONTINUOUS
            )

        # NOTE: order matters here. API orders by date_added
        expected_activations = new_activation + yesterday_activation

        params = {
            "start": now - timedelta(days=1),
            "end": now + timedelta(days=1),
        }
        with self.feature("organizations:incidents"):
            resp = self.get_response(self.organization.slug, alert_rule.id, **params)

        assert serialize(old_activation) not in resp.data
        assert resp.data == serialize(expected_activations)
