from unittest.mock import patch

from sentry.notifications.types import NotificationOrigin
from sentry.notifications.utils.rules import (
    get_notification_origins,
    get_workflow_url,
)
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Workflow


def test_get_workflow_url() -> None:
    assert (
        get_workflow_url(
            NotificationOrigin(
                label="alert",
                environment_id=None,
                workflow_id=2,
                legacy_rule_id=1,
            ),
            "org-slug",
        )
        == "http://testserver/organizations/org-slug/monitors/alerts/2/"
    )


def test_get_workflow_url_warns_when_workflow_id_is_missing() -> None:
    origin = NotificationOrigin(
        label="alert",
        environment_id=None,
        workflow_id=None,
        legacy_rule_id=1,
    )

    with patch("sentry.notifications.utils.rules.logger") as logger:
        assert get_workflow_url(origin, "org-slug") is None

    logger.warning.assert_called_once_with(
        "notifications.workflow_url.missing_workflow_id",
        extra={"legacy_rule_id": 1},
    )


def test_get_workflow_url_warns_when_origin_has_no_ids() -> None:
    origin = NotificationOrigin(
        label="alert",
        environment_id=None,
        workflow_id=None,
        legacy_rule_id=None,
    )

    with patch("sentry.notifications.utils.rules.logger") as logger:
        assert get_workflow_url(origin, "org-slug") is None

    logger.warning.assert_called_once_with(
        "notifications.workflow_url.missing_workflow_id",
        extra={"legacy_rule_id": None},
    )


class GetNotificationOriginsTest(TestCase):
    def test_resolves_workflow_with_legacy_identity(self) -> None:
        environment = self.create_environment(project=self.project)
        rule = self.create_project_rule(project=self.project)
        workflow_id = int(rule.data["actions"][0]["workflow_id"])
        Workflow.objects.filter(id=workflow_id).update(environment_id=environment.id)

        origins = get_notification_origins(self.project, workflow_ids=[workflow_id])

        assert len(origins) == 1
        assert origins[0].workflow_id == workflow_id
        assert origins[0].legacy_rule_id == rule.id
        assert origins[0].environment_id == environment.id

    def test_maps_legacy_identity_to_workflow(self) -> None:
        rule = self.create_project_rule(project=self.project)
        workflow_id = int(rule.data["actions"][0]["workflow_id"])

        origins = get_notification_origins(self.project, legacy_rule_ids=[rule.id])

        assert len(origins) == 1
        assert origins[0].workflow_id == workflow_id
        assert origins[0].legacy_rule_id == rule.id

    def test_deduplicates_dual_identity(self) -> None:
        rule = self.create_project_rule(project=self.project)
        workflow_id = int(rule.data["actions"][0]["workflow_id"])

        origins = get_notification_origins(
            self.project, workflow_ids=[workflow_id], legacy_rule_ids=[rule.id]
        )

        assert len(origins) == 1
