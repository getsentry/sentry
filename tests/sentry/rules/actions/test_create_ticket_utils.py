from unittest.mock import MagicMock

from sentry.rules.actions.integrations.create_ticket.utils import (
    build_description,
    build_description_workflow_engine_ui,
)
from sentry.testutils.cases import TestCase


class CreateTicketUtilsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.rule = self.create_project_rule()

    def test_build_description(self) -> None:
        installation = MagicMock()
        installation.get_group_description.return_value = "Test description"

        def generate_footer(url) -> str:
            return f"\n\nThis issue was created by a rule: {url}"

        description = build_description(self.event, self.rule.id, installation, generate_footer)

        expected_url = f"/organizations/{self.organization.slug}/alerts/rules/{self.project.slug}/{self.rule.id}/"
        assert (
            description == f"Test description\n\nThis issue was created by a rule: {expected_url}"
        )

    def test_build_description_workflow_engine_ui(self) -> None:
        installation = MagicMock()
        installation.get_group_description.return_value = "Test description"
        workflow_id = 123

        def generate_footer(url) -> str:
            return f"\n\nThis issue was created by a workflow: {url}"

        description = build_description_workflow_engine_ui(
            self.event, workflow_id, installation, generate_footer
        )

        expected_url = f"/organizations/{self.organization.slug}/monitors/alerts/{workflow_id}/"
        assert (
            description
            == f"Test description\n\nThis issue was created by a workflow: {expected_url}"
        )
