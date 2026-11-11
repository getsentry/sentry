from unittest.mock import MagicMock, patch

from django.conf import settings

from sentry.integrations.services.jira_forge import jira_forge_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class JiraForgeServiceTest(TestCase):
    @patch("sentry.integrations.services.jira_forge.impl.apply_forge_issue_event.delay")
    def test_queues_event(self, delay: MagicMock) -> None:
        event = {"issue": {"key": "APP-1"}, "changelog": {"id": "1", "items": []}}

        jira_forge_service.handle_issue_updated(
            cell_name=settings.SENTRY_FALLBACK_CELL, integration_id=123, event=event
        )

        delay.assert_called_once_with(integration_id=123, event=event)
