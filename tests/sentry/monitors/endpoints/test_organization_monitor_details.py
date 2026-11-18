from django.test import override_settings
from django.urls import reverse
from rest_framework.response import Response

from sentry.monitors.models import Monitor
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context
from tests.sentry.monitors.endpoints.test_base_monitor_details import (
    BaseDeleteMonitorTest,
    BaseMonitorDetailsTest,
    BaseUpdateMonitorTest,
)


class OrganizationMonitorDetailsTest(BaseMonitorDetailsTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True


class UpdateMonitorTest(BaseUpdateMonitorTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True


class DeleteMonitorTest(BaseDeleteMonitorTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True


@override_settings(SEER_API_SHARED_SECRET="service-account-secret")
@with_feature("organizations:service-accounts")
class OrganizationMonitorDetailsServiceAccountTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-details"

    def get_as_service_account(self, monitor: Monitor) -> Response:
        service_account = self.create_service_account(
            organization=self.organization,
            scope_list=["project:read"],
            project_ids=[self.project.id],
        )
        viewer_context = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                organization_id=self.organization.id,
            ),
            key="service-account-secret",
        )
        return self.client.get(
            reverse(self.endpoint, args=[self.organization.slug, monitor.slug]),
            HTTP_X_VIEWER_CONTEXT=viewer_context,
        )

    def test_service_account_reads_monitor_on_linked_project(self) -> None:
        monitor = self.create_monitor(project=self.project)

        response = self.get_as_service_account(monitor)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(monitor.guid)

    def test_service_account_cannot_read_monitor_on_unlinked_project(self) -> None:
        unlinked = self.create_project(organization=self.organization)
        monitor = self.create_monitor(project=unlinked)

        response = self.get_as_service_account(monitor)

        assert response.status_code == 403, response.content
