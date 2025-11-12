import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from django.db import router, transaction
from rest_framework.request import Request

from sentry.models.project import Project
from sentry.models.rule import Rule, RuleSource
from sentry.types.actor import Actor
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.processors.detector import ensure_default_detectors

logger = logging.getLogger(__name__)


@dataclass
class ProjectRuleCreator:
    name: str
    project: Project
    action_match: str
    actions: Sequence[dict[str, Any]]
    conditions: Sequence[dict[str, Any]]
    frequency: int
    environment: int | None = None
    owner: Actor | None = None
    filter_match: str | None = None
    source: RuleSource | None = RuleSource.ISSUE
    request: Request | None = None

    def run(self) -> Rule:
        ensure_default_detectors(self.project)

        with transaction.atomic(router.db_for_write(Rule)):
            self.rule = self._create_rule()

            # uncaught errors will rollback the transaction
            workflow = IssueAlertMigrator(
                self.rule, self.request.user.id if self.request else None
            ).run()
            logger.info(
                "workflow_engine.issue_alert.migrated",
                extra={"rule_id": self.rule.id, "workflow_id": workflow.id},
            )

        return self.rule

    def _create_rule(self) -> Rule:
        kwargs = self._get_kwargs()
        rule = Rule.objects.create(**kwargs)

        return rule

    def _get_kwargs(self) -> dict[str, Any]:
        data = {
            "filter_match": self.filter_match,
            "action_match": self.action_match,
            "actions": self.actions,
            "conditions": self.conditions,
            "frequency": self.frequency,
        }
        _kwargs = {
            "label": self.name,
            "environment_id": self.environment or None,
            "project": self.project,
            "data": data,
            "owner": self.owner,
            "source": self.source,
        }
        return _kwargs
