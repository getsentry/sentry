from __future__ import annotations

from typing import Any

from sentry.integrations.msteams.card_builder.block import AdaptiveCard
from sentry.integrations.msteams.card_builder.issues import MSTeamsIssueMessageBuilder
from sentry.integrations.services.integration import integration_service
from sentry.models.group import GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.notifications.platform.msteams.renderers.issue import IssueMSTeamsRenderer
from sentry.notifications.platform.templates.issue import (
    IssueNotificationData,
    SerializableRuleProxy,
)
from sentry.notifications.platform.types import NotificationRenderedTemplate
from sentry.testutils.cases import TestCase


def without_integration_id(card: Any) -> Any:
    """
    Strip `integrationId` from a card so the two builders can be compared. The platform renderer
    cannot emit it, since it has no access to the target the card is being sent to.
    """
    if isinstance(card, dict):
        return {k: without_integration_id(v) for k, v in card.items() if k != "integrationId"}
    if isinstance(card, list):
        return [without_integration_id(v) for v in card]
    return card


class IssueCardLegacyParityTest(TestCase):
    """
    The platform renderer must produce the same card as the legacy issue alert card builder for
    every group state, so that the cutover is invisible to users and the webhook can keep
    handling action payloads from cards built by either path.
    """

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="msteams",
            name="Fellowship of the Ring",
            external_id="f3ll0wsh1p",
            metadata={"service_url": "https://smba.trafficmanager.net/amer"},
        )
        self.event = self.store_event(
            data={"message": "oh no", "level": "error"},
            project_id=self.project.id,
        )
        assert self.event.group is not None
        self.issue_group = self.event.group
        self.rule = self.create_project_rule(project=self.project, name="Issue Stream")

    def legacy_card(self) -> AdaptiveCard:
        rpc_integration = integration_service.get_integration(integration_id=self.integration.id)
        assert rpc_integration is not None
        return MSTeamsIssueMessageBuilder(
            self.issue_group, self.event, [self.rule], rpc_integration
        ).build_group_card()

    def platform_card(self) -> AdaptiveCard:
        data = IssueNotificationData(
            group_id=self.issue_group.id,
            event_id=self.event.event_id,
            notification_uuid="",
            rule=SerializableRuleProxy.from_rule(self.rule),
        )
        return IssueMSTeamsRenderer.render(
            data=data,
            rendered_template=NotificationRenderedTemplate(subject="Issue Alert", body=[]),
        )

    def assert_parity(self) -> None:
        self.issue_group.refresh_from_db()
        assert without_integration_id(self.legacy_card()) == without_integration_id(
            self.platform_card()
        )

    def test_parity_for_unresolved_issue(self) -> None:
        self.assert_parity()

    def test_parity_for_resolved_issue(self) -> None:
        self.issue_group.update(status=GroupStatus.RESOLVED, substatus=None)
        self.assert_parity()

    def test_parity_for_archived_issue(self) -> None:
        self.issue_group.update(status=GroupStatus.IGNORED, substatus=None)
        self.assert_parity()

    def test_parity_for_assigned_issue(self) -> None:
        GroupAssignee.objects.assign(self.issue_group, self.user)
        self.assert_parity()

    def test_parity_for_issue_with_teams(self) -> None:
        self.create_team(organization=self.organization, slug="micro-team")
        self.project.add_team(self.create_team(organization=self.organization, slug="rivendell"))
        self.assert_parity()
