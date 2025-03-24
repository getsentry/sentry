import logging
from collections.abc import Sequence

from attr import dataclass
from django.db import router, transaction
from rest_framework.request import Request

from sentry import features
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.types.actor import Actor
from sentry.workflow_engine.migration_helpers.issue_alert_dual_write import (
    update_migrated_issue_alert,
)

logger = logging.getLogger(__name__)


@dataclass
class ProjectRuleUpdater:
    rule: Rule
    project: Project
    name: str | None = None
    owner: Actor | None = None
    environment: int | None = None
    action_match: str | None = None
    filter_match: str | None = None
    actions: Sequence[dict[str, str]] | None = None
    conditions: Sequence[dict[str, str]] | None = None
    frequency: int | None = None
    request: Request | None = None

    def run(self) -> Rule:
        with transaction.atomic(router.db_for_write(Rule)):
            self._update_name()
            self._update_owner()
            self._update_environment()
            self._update_project()
            self._update_actions()
            self._update_action_match()
            self._update_filter_match()
            self._update_conditions()
            self._update_frequency()
            self.rule.save()

            if features.has(
                "organizations:workflow-engine-issue-alert-dual-write", self.project.organization
            ):
                # uncaught errors will rollback the transaction
                workflow = update_migrated_issue_alert(self.rule)
                if workflow:
                    logger.info(
                        "workflow_engine.issue_alert.updated",
                        extra={"rule_id": self.rule.id, "workflow_id": workflow.id},
                    )
            return self.rule

    def _update_name(self) -> None:
        if self.name:
            self.rule.label = self.name

    def _update_owner(self) -> None:
        self.rule.owner = self.owner

    def _update_environment(self) -> None:
        self.rule.environment_id = self.environment

    def _update_project(self) -> None:
        if self.project:
            self.rule.project = self.project

    def _update_actions(self) -> None:
        if self.actions:
            self.rule.data["actions"] = self.actions

    def _update_action_match(self) -> None:
        if self.action_match:
            self.rule.data["action_match"] = self.action_match

    def _update_filter_match(self) -> None:
        if self.filter_match:
            self.rule.data["filter_match"] = self.filter_match

    def _update_conditions(self) -> None:
        self.rule.data["conditions"] = self.conditions or []

    def _update_frequency(self) -> None:
        if self.frequency:
            self.rule.data["frequency"] = self.frequency
