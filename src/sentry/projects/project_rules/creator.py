import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from django.db import router, transaction
from rest_framework.request import Request

from sentry.models.project import Project
from sentry.models.rule import Rule, RuleSource
from sentry.types.actor import Actor
from sentry.workflow_engine.defaults.detectors import ensure_default_detectors
from sentry.workflow_engine.defaults.workflows import ensure_default_workflows
from sentry.workflow_engine.models import AlertRuleWorkflow
from sentry.workflow_engine.utils.legacy_metric_tracking import report_used_legacy_models

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
            workflows = ensure_default_workflows(self.project)
            self.rule = self._create_rule()

            legacy_references = [
                AlertRuleWorkflow(
                    rule_id=self.rule.id,
                    workflow=workflow,
                )
                for workflow in workflows
            ]

            AlertRuleWorkflow.objects.bulk_create(legacy_references)

        return self.rule

    def _create_rule(self) -> Rule:
        kwargs = self._get_kwargs()
        rule = Rule.objects.create(**kwargs)
        # Mark that we're using legacy Rule models
        report_used_legacy_models()

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
