"""Seed and inspect an isolated Seer/WFE demo in a development environment.

Run through `sentry exec`; see docs/seer-wfe-mvp.md for the browser/API walkthrough.
"""

import argparse
import sys
from datetime import timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

import click
from django.conf import settings

from sentry import features
from sentry.eventstream.base import GroupState
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import SeerWorkflowConfigExtras, SeerWorkflowStrategy
from sentry.seer.workflows.base import SeerServiceAccountGrant, SelectedMonitors
from sentry.seer.workflows.configuration import investigation_actions
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.users.models.user import User
from sentry.utils import json
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.tasks.workflows import process_workflows_event
from sentry.workflow_engine.types import DetectorPriorityLevel


def seed(organization: Organization, project: Project, user: User) -> dict[str, Any]:
    if not features.has("organizations:seer-automations", organization):
        raise ValueError(
            "Enable organizations:seer-automations in the box's development configuration first"
        )
    marker = uuid4().hex[:8]
    detectors = []
    for label in ("Checkout errors", "API errors"):
        query = create_snuba_query(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            query="",
            aggregate="count()",
            time_window=timedelta(minutes=5),
            resolution=timedelta(minutes=1),
            environment=None,
        )
        subscription = create_snuba_subscription(
            project=project, subscription_type="incidents", snuba_query=query
        )
        source, _ = DataSource.objects.get_or_create(
            organization=organization,
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            source_id=str(subscription.id),
        )
        threshold = DataConditionGroup.objects.create(
            organization=organization, logic_type=DataConditionGroup.Type.ANY
        )
        for condition, priority in (
            (Condition.GREATER, DetectorPriorityLevel.HIGH),
            (Condition.LESS_OR_EQUAL, DetectorPriorityLevel.OK),
        ):
            DataCondition.objects.create(
                condition_group=threshold, type=condition, comparison=100, condition_result=priority
            )
        detector = Detector.objects.create(
            project=project,
            name=f"WFE demo {marker}: {label}",
            type=MetricIssue.slug,
            enabled=True,
            config={"detection_type": "static"},
            workflow_condition_group=threshold,
        )
        DataSourceDetector.objects.create(data_source=source, detector=detector)
        detectors.append(detector)
    workflow = SeerWorkflow.create(
        organization_id=organization.id,
        strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
        enabled=True,
        scope=SelectedMonitors(tuple(detector.id for detector in detectors)),
        extras=SeerWorkflowConfigExtras(
            name=f"Investigate API errors {marker}", created_by=user.id
        ),
        service_account_grant=SeerServiceAccountGrant(
            scopes=["event:read", "org:read"], project_ids=[project.id]
        ),
    )
    config = workflow.get_config()
    return {
        "organization_id": organization.id,
        "organization_slug": organization.slug,
        "project_id": project.id,
        "config_id": config.id,
        "workflow_id": config.backing_workflow_id,
        "detector_ids": [detector.id for detector in detectors],
    }


def show(state: dict[str, Any], workflow: SeerWorkflow) -> dict[str, Any]:
    config = workflow.get_config()
    action = investigation_actions(config).get()
    assert config.backing_workflow is not None
    return {
        **state,
        "workflow": {
            "id": config.backing_workflow_id,
            "name": config.backing_workflow.name,
            "enabled": config.backing_workflow.enabled,
        },
        "seer_config": {
            "id": config.id,
            "service_account_id": config.service_account_id,
            "extras": config.extras,
        },
        "action": {"id": action.id, "type": action.type, "data": action.data},
        "automation_path": f"/organizations/{state['organization_slug']}/seer/automations/{config.id}/",
        "runs": [
            {
                "id": run.id,
                "trigger_key": run.trigger_key,
                "status": run.status,
                "extras": run.extras,
                "executions": [
                    {"id": execution.id, "status": execution.status, "extras": execution.extras}
                    for execution in run.executions.all()
                ],
            }
            for run in workflow.get_runs().prefetch_related("executions")[:20]
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["seed", "show", "replay", "enable", "disable"])
    parser.add_argument("--org", default="sentry")
    parser.add_argument(
        "--project", help="An existing disposable development project; required for seed"
    )
    parser.add_argument("--user", default="admin@sentry.io")
    parser.add_argument("--state", type=Path, default=Path(".artifacts/seer-wfe-demo.json"))
    args = parser.parse_args(click.get_current_context().args)
    if not settings.IS_DEV:
        parser.error("This command only runs in a development environment")
    if args.command == "seed" and not args.state.exists():
        if args.project is None:
            parser.error("Pass --project with the disposable development project's slug")
        organization = Organization.objects.get(slug=args.org)
        state = seed(
            organization,
            Project.objects.get(organization=organization, slug=args.project),
            User.objects.get(email=args.user, is_active=True),
        )
        args.state.parent.mkdir(parents=True, exist_ok=True)
        args.state.write_text(json.dumps(state))
    else:
        state = json.loads(args.state.read_text())
    workflow = SeerWorkflow(organization_id=state["organization_id"], config_id=state["config_id"])
    if args.command in {"enable", "disable"}:
        with workflow.update_config() as update:
            update.set_enabled(args.command == "enable")
    elif args.command == "replay":
        run = workflow.get_runs().first()
        if run is None:
            parser.error("Fire a monitor through the staff simulator and wait for its first run")
        inputs = run.extras["snapshot"]["inputs"]
        process_workflows_event.delay(
            event_id=inputs["event_id"],
            group_id=inputs["group_id"],
            occurrence_id=inputs["occurrence_id"],
            group_state=GroupState(
                id=inputs["group_id"],
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
            ),
            has_escalated=False,
        )
    sys.stdout.write(json.dumps(show(state, workflow)) + "\n")


main()
