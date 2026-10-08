from __future__ import annotations

import uuid
from collections.abc import Callable, Generator
from contextlib import AbstractContextManager, contextmanager, nullcontext
from dataclasses import asdict, replace
from datetime import timedelta
from functools import partial
from typing import Any
from unittest import mock

import orjson
import pytest

from sentry.grouping.grouptype import ErrorGroupType
from sentry.integrations.types import ExternalProviders
from sentry.issues.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.projectownership import ProjectOwnership
from sentry.notifications.additional_attachment_manager import manager as attachment_manager
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.utils import (
    execute_via_group_type_registry,
    execute_via_issue_alert_handler,
    execute_via_metric_alert_handler,
    issue_notification_data_factory,
    metric_alert_notification_data_factory,
)
from sentry.notifications.platform.shadow.capture import SHADOW_PROVIDERS, _variant
from sentry.notifications.platform.shadow.compare import ShadowOutcome
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.services.eventstore.models import GroupEvent
from sentry.shared_integrations.exceptions import ApiError
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import ActionInvocation, DetectorPriorityLevel, WorkflowEventData
from tests.sentry.issues.test_utils import OccurrenceTestMixin
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)
from tests.sentry.notifications.platform.shadow.test_capture import SAMPLE_ALL, VARIANT_DAILY_LIMIT
from tests.sentry.notifications.platform.shadow.test_compare import (
    COMPARE_PATH,
    ShadowObservation,
    observe_shadow,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]

NOTIFICATION_UUID = "7f7b1a5e-2c1d-4a53-9a57-0b3bde3b1c11"
SLACK_ISSUE_CLIENT = "sentry.integrations.slack.actions.notification.SlackSdkClient"
DISCORD_ISSUE_CLIENT = "sentry.integrations.discord.actions.issue_alert.notification.DiscordClient"
MSTEAMS_ISSUE_CLIENT = "sentry.integrations.msteams.actions.notification.MsTeamsClient"
SLACK_METRIC_CLIENT = "sentry.integrations.slack.utils.notifications.SlackSdkClient"
DISCORD_METRIC_CLIENT = "sentry.integrations.discord.actions.metric_alert.DiscordClient"
MSTEAMS_METRIC_SEND = (
    "sentry.integrations.msteams.utils.integration_service.send_msteams_incident_alert_notification"
)
SLACK_METRIC_HANDLER = "sentry.notifications.notification_action.metric_alert_registry.handlers.slack_metric_alert_handler"

CLIENTS = {
    "issue": {
        "slack": SLACK_ISSUE_CLIENT,
        "slack_staging": SLACK_ISSUE_CLIENT,
        "discord": DISCORD_ISSUE_CLIENT,
        "msteams": MSTEAMS_ISSUE_CLIENT,
    },
    "metric-alert": {
        "slack": SLACK_METRIC_CLIENT,
        "slack_staging": SLACK_METRIC_CLIENT,
        "discord": DISCORD_METRIC_CLIENT,
        "msteams": MSTEAMS_METRIC_SEND,
    },
}


class ShadowReadTestBase(BaseWorkflowTest):
    source: str

    def create_shadow_action(
        self,
        provider: str,
        data: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Action:
        integration = self.create_integration(
            organization=self.organization,
            provider=provider,
            external_id=f"{provider}-workspace",
            name=f"{provider} workspace",
            metadata=metadata or {},
        )
        return self.create_action(
            type=provider,
            integration_id=integration.id,
            data=data or {},
            config={
                "target_identifier": "C12345",
                "target_display": "#alerts",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

    def send(
        self,
        invocation: ActionInvocation,
        entry: Callable[[ActionInvocation], None] = execute_via_group_type_registry,
    ) -> tuple[ShadowObservation, mock.MagicMock]:
        """
        Sends the alert through the workflow engine with the provider client mocked, and returns
        what the shadow reported along with the client mock.
        """
        with (
            observe_shadow() as observation,
            mock.patch(CLIENTS[self.source][invocation.action.type]) as client,
        ):
            if invocation.action.type in ("slack", "slack_staging"):
                client.return_value.chat_postMessage.return_value = {"ts": "1234.5678"}
            entry(invocation)
        return observation, client


class ShadowReadIssueAlertTest(ShadowReadTestBase, OccurrenceTestMixin):
    source = "issue"

    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options(SAMPLE_ALL))
        self.workflow = self.create_workflow(organization=self.organization, name="Shadow Workflow")
        self.detector = Detector.objects.filter(
            project=self.project, type=ErrorGroupType.slug
        ).first() or self.create_detector(project=self.project, type=ErrorGroupType.slug)
        self.event = self.store_event(
            data={"message": "oh no", "level": "error", "tags": {"foo": "bar"}},
            project_id=self.project.id,
        )
        assert self.event.group is not None
        self.issue_group = self.event.group

    def invocation(self, action: Action) -> ActionInvocation:
        return ActionInvocation(
            event_data=WorkflowEventData(
                event=self.event.for_group(self.issue_group), group=self.issue_group
            ),
            action=action,
            detector=self.detector,
            notification_uuid=NOTIFICATION_UUID,
            workflow_id=self.workflow.id,
        )

    def occurrence_invocation(self, action: Action) -> ActionInvocation:
        _, group_info = self.process_occurrence(
            event_id=uuid.uuid4().hex,
            project_id=self.project.id,
            event_data={"timestamp": before_now(minutes=1).isoformat()},
        )
        assert group_info is not None
        event = group_info.group.get_latest_event()
        assert isinstance(event, GroupEvent) and event.occurrence is not None
        return ActionInvocation(
            event_data=WorkflowEventData(event=event, group=group_info.group),
            action=action,
            detector=self.detector,
            notification_uuid=NOTIFICATION_UUID,
            workflow_id=self.workflow.id,
        )

    def assert_match(self, observation: ShadowObservation) -> None:
        assert observation.outcome == ShadowOutcome.MATCH, observation.mismatch
        legacy, _ = observation.payloads
        assert NOTIFICATION_UUID in orjson.dumps(legacy).decode()

    def test_slack_matches(self) -> None:
        action = self.create_shadow_action("slack", {"tags": "level,foo", "notes": "@on-call"})

        observation, client = self.send(self.invocation(action))

        client.return_value.chat_postMessage.assert_called_once()
        self.assert_match(observation)

    def test_skips_when_the_group_status_changed(self) -> None:
        action = self.create_shadow_action("slack", {"tags": "", "notes": ""})
        invocation = self.invocation(action)
        Group.objects.get(id=self.issue_group.id).update(status=GroupStatus.RESOLVED)

        observation, client = self.send(invocation)

        client.return_value.chat_postMessage.assert_called_once()
        assert observation.outcome == ShadowOutcome.GROUP_CHANGED
        assert observation.mismatch is None

    def test_skips_when_the_rendered_last_seen_changed(self) -> None:
        action = self.create_shadow_action("discord", {"tags": ""})
        invocation = self.invocation(action)
        Group.objects.get(id=self.issue_group.id).update(
            last_seen=self.event.datetime + timedelta(minutes=1)
        )

        observation, _ = self.send(invocation)

        assert observation.outcome == ShadowOutcome.GROUP_CHANGED

    def test_compares_when_last_seen_changed_before_the_event(self) -> None:
        action = self.create_shadow_action("discord", {"tags": ""})
        invocation = self.invocation(action)
        Group.objects.get(id=self.issue_group.id).update(
            last_seen=self.event.datetime - timedelta(minutes=1)
        )

        observation, _ = self.send(invocation)

        self.assert_match(observation)

    def test_slack_mentions_read_scope_without_nudge(self) -> None:
        action = self.create_shadow_action(
            "slack", {"tags": "", "notes": ""}, metadata={"scopes": ["app_mentions:read"]}
        )

        observation, _ = self.send(self.invocation(action))

        self.assert_match(observation)

    def test_slack_occurrence_matches(self) -> None:
        action = self.create_shadow_action("slack", {"tags": "level", "notes": ""})
        invocation = self.occurrence_invocation(action)

        observation, _ = self.send(invocation)

        self.assert_match(observation)
        legacy, _ = observation.payloads
        assert invocation.event_data.group.title in legacy["text"]

    @with_feature("organizations:slack-reinstall-nudge-on-issue-alert")
    @override_options({"slack.nudge-frequency": 1.0})
    def test_slack_nudge_matches(self) -> None:
        action = self.create_shadow_action("slack", {"tags": "", "notes": ""})

        observation, client = self.send(self.invocation(action))

        sent_blocks = orjson.loads(client.return_value.chat_postMessage.call_args.kwargs["blocks"])
        assert "reinstall Sentry Slack app" in str(sent_blocks[-1])
        self.assert_match(observation)

    @with_feature("organizations:slack-reinstall-nudge-on-issue-alert")
    @override_options({"slack.nudge-frequency": 1.0})
    def test_slack_mentions_read_scope_nudge_matches(self) -> None:
        action = self.create_shadow_action(
            "slack", {"tags": "", "notes": ""}, metadata={"scopes": ["app_mentions:read"]}
        )

        observation, _ = self.send(self.invocation(action))

        legacy, _ = observation.payloads
        assert "Mention or tag Sentry" in str(legacy["blocks"][-1])
        self.assert_match(observation)

    @with_feature("organizations:slack-reinstall-nudge-on-issue-alert")
    @override_options({"slack.nudge-frequency": 0.5})
    def test_slack_sampled_nudge_matches(self) -> None:
        action = self.create_shadow_action("slack", {"tags": "", "notes": ""})
        nudged = set()

        for i in range(8):
            invocation = replace(self.invocation(action), notification_uuid=f"{i:032x}")
            observation, _ = self.send(invocation)

            assert observation.outcome == ShadowOutcome.MATCH, observation.mismatch
            legacy, _ = observation.payloads
            nudged.add("reinstall Sentry Slack app" in str(legacy["blocks"][-1]))

        assert nudged == {True, False}

    def test_slack_additional_attachment_matches(self) -> None:
        attachment = {"type": "section", "text": {"type": "mrkdwn", "text": "extra"}}
        action = self.create_shadow_action("slack", {"tags": "", "notes": ""})

        with mock.patch.dict(
            attachment_manager.attachment_generators,
            {ExternalProviders.SLACK: lambda integration, organization: [attachment]},
        ):
            observation, _ = self.send(self.invocation(action))

        self.assert_match(observation)
        legacy, _ = observation.payloads
        assert legacy["blocks"][-1] == attachment

    def test_slack_staging_matches(self) -> None:
        action = self.create_shadow_action("slack_staging", {"tags": "level", "notes": ""})

        observation, _ = self.send(self.invocation(action))

        self.assert_match(observation)
        assert observation.results[0]["provider"] == "slack_staging"

    def test_discord_matches(self) -> None:
        action = self.create_shadow_action("discord", {"tags": "level,foo"})

        observation, client = self.send(self.invocation(action))

        client.return_value.send_message.assert_called_once()
        self.assert_match(observation)

    def test_discord_occurrence_matches(self) -> None:
        action = self.create_shadow_action("discord", {"tags": "level"})

        observation, _ = self.send(self.occurrence_invocation(action))

        self.assert_match(observation)

    def test_msteams_matches(self) -> None:
        action = self.create_shadow_action("msteams")

        observation, client = self.send(self.invocation(action))

        client.return_value.send_card.assert_called_once()
        self.assert_match(observation)

    def test_msteams_occurrence_matches(self) -> None:
        action = self.create_shadow_action("msteams")

        observation, _ = self.send(self.occurrence_invocation(action))

        self.assert_match(observation)

    def matrix_invocation(
        self, action: Action, occurrence: bool, toggles: frozenset[str]
    ) -> ActionInvocation:
        """
        Builds an invocation on a fresh project, so project-wide toggles like releases and
        ownership don't leak into other cases.
        """
        project = self.create_project(organization=self.organization)
        if "releases" in toggles:
            project.flags.has_releases = True
            project.save()
        if "suggested" in toggles:
            ProjectOwnership.objects.create(
                project_id=project.id,
                schema=dump_schema(
                    [Rule(Matcher("tags.foo", "bar"), [Owner("user", self.user.email)])]
                ),
                fallthrough=False,
            )
        detector = self.create_detector(project=project, type=ErrorGroupType.slug)

        if occurrence:
            _, group_info = self.process_occurrence(
                project_id=project.id,
                event_id=uuid.uuid4().hex,
                event_data={"timestamp": before_now(minutes=1).isoformat()},
            )
            assert group_info is not None
            group = group_info.group
            event = group.get_latest_event()
            assert isinstance(event, GroupEvent) and event.occurrence is not None
        else:
            stored = self.store_event(
                data={"message": "oh no", "level": "error", "tags": {"foo": "bar"}},
                project_id=project.id,
            )
            assert stored.group is not None
            group = stored.group
            event = stored.for_group(group)

        if "resolved" in toggles:
            group.update(status=GroupStatus.RESOLVED, substatus=None)
        elif "ignored" in toggles:
            group.update(status=GroupStatus.IGNORED, substatus=GroupSubStatus.FOREVER)
        elif "not_new" in toggles:
            group.update(substatus=GroupSubStatus.ONGOING)
        if "assigned" in toggles:
            GroupAssignee.objects.assign(group, self.team)

        # The legacy Slack path reads the environment off the Workflow, while the platform
        # path reads it from workflow_env, so keep them in sync like production does.
        workflow = self.create_workflow(
            organization=self.organization,
            environment=self.environment if "env" in toggles else None,
        )
        if "legacy_rule" in toggles:
            self.create_alert_rule_workflow(
                rule_id=self.create_project_rule(project=project).id, workflow=workflow
            )

        return ActionInvocation(
            event_data=WorkflowEventData(
                event=event,
                group=Group.objects.get_from_cache(id=group.id),
                workflow_env=workflow.environment,
            ),
            action=action,
            detector=detector,
            notification_uuid=NOTIFICATION_UUID,
            workflow_id=workflow.id,
        )

    def test_variant_matrix_matches(self) -> None:
        """
        Every provider renders the same as legacy with each branch the legacy renderers take
        toggled on alone, and with all of them on together.
        """
        toggles = (
            "config",
            "resolved",
            "ignored",
            "not_new",
            "env",
            "legacy_rule",
            "assigned",
            "releases",
            "suggested",
        )
        cases = [
            frozenset(),
            *(frozenset({toggle}) for toggle in toggles),
            frozenset(toggles) - {"ignored", "not_new"},
        ]
        configs = {
            "slack": {"tags": "level,foo", "notes": "@on-call"},
            "discord": {"tags": "level,foo"},
            "msteams": {},
        }
        failures = []
        logs = []

        for provider, config in configs.items():
            configured = self.create_shadow_action(provider, config)
            plain = self.create_action(
                type=provider, integration_id=configured.integration_id, config=configured.config
            )
            for occurrence in (False, True):
                for case in cases:
                    action = configured if "config" in case else plain
                    observation, _ = self.send(self.matrix_invocation(action, occurrence, case))
                    logs.append(observation.result_log)
                    if observation.outcome != ShadowOutcome.MATCH:
                        failures.append(
                            (
                                provider,
                                occurrence,
                                sorted(case),
                                observation.outcome,
                                observation.mismatch,
                            )
                        )

        assert failures == []
        variants = {log["variant"] for log in logs}
        for part in (":resolved:", ":ignored:", ":not_new:", ":env:", ":rule:", ":assigned"):
            assert any(part in variant for variant in variants), part
        for trait in ("has_releases", "has_suggested_assignees"):
            assert any(log.get(trait) for log in logs), trait

    def test_platform_data_carries_occurrence_id(self) -> None:
        invocation = self.occurrence_invocation(self.create_shadow_action("slack"))
        event = invocation.event_data.event
        assert isinstance(event, GroupEvent)

        data = issue_notification_data_factory(invocation)

        assert data.occurrence_id is not None
        assert data.occurrence_id == event.occurrence_id

    def test_execute_via_issue_alert_handler(self) -> None:
        action = self.create_shadow_action("msteams")

        with observe_shadow() as observation, mock.patch(MSTEAMS_ISSUE_CLIENT):
            execute_via_issue_alert_handler(self.invocation(action))

        assert observation.outcome == ShadowOutcome.MATCH, observation.mismatch

    def test_integration_removed_is_not_captured(self) -> None:
        action = self.create_shadow_action("discord", {"tags": ""})
        assert action.integration_id is not None
        action.update(integration_id=action.integration_id + 1000)

        observation, client = self.send(self.invocation(action))

        client.return_value.send_message.assert_not_called()
        assert observation.outcome == ShadowOutcome.LEGACY_NOT_CAPTURED

    def test_compares_when_the_send_raises(self) -> None:
        action = self.create_shadow_action("slack", {"tags": "", "notes": ""})
        error = ApiError("slack is down")

        with (
            observe_shadow() as observation,
            mock.patch(SLACK_ISSUE_CLIENT) as client,
            pytest.raises(Exception) as excinfo,
        ):
            client.return_value.chat_postMessage.side_effect = error
            execute_via_group_type_registry(self.invocation(action))

        assert excinfo.value.__cause__ is error
        self.assert_match(observation)

    @mock.patch(f"{COMPARE_PATH}.sentry_sdk.capture_exception")
    @mock.patch(
        f"{COMPARE_PATH}.NotificationService.render_template", side_effect=RuntimeError("platform")
    )
    def test_platform_error_does_not_affect_the_send(
        self, mock_render: mock.MagicMock, mock_capture: mock.MagicMock
    ) -> None:
        action = self.create_shadow_action("msteams")

        observation, client = self.send(self.invocation(action))

        client.return_value.send_card.assert_called_once()
        assert observation.outcome == ShadowOutcome.PLATFORM_ERROR
        mock_capture.assert_called_once_with(mock_render.side_effect)

    @override_options({VARIANT_DAILY_LIMIT: 0})
    @mock.patch(f"{COMPARE_PATH}.NotificationService.render_template")
    def test_not_sampled(self, mock_render: mock.MagicMock) -> None:
        action = self.create_shadow_action("msteams")

        observation, client = self.send(self.invocation(action))

        client.return_value.send_card.assert_called_once()
        assert observation.results == []
        mock_render.assert_not_called()


class ShadowReadMetricAlertTest(ShadowReadTestBase, MetricAlertHandlerBase):
    source = "metric-alert"

    def setUp(self) -> None:
        self.create_models()
        self.enterContext(override_options(SAMPLE_ALL))

    def invocation(self, action: Action) -> ActionInvocation:
        return ActionInvocation(
            event_data=self.event_data,
            action=action,
            detector=self.detector,
            notification_uuid=NOTIFICATION_UUID,
            workflow_id=self.workflow.id,
        )

    def resolution_invocation(self, action: Action) -> ActionInvocation:
        activity = Activity(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data=asdict(self.evidence_data),
        )
        activity.save()
        return ActionInvocation(
            event_data=WorkflowEventData(
                event=activity, workflow_env=self.workflow.environment, group=self.group
            ),
            action=action,
            detector=self.detector,
            notification_uuid=NOTIFICATION_UUID,
            workflow_id=self.workflow.id,
        )

    def assert_match(
        self,
        invocation: ActionInvocation,
        entry: Callable[[ActionInvocation], None] = execute_via_group_type_registry,
    ) -> mock.MagicMock:
        observation, client = self.send(invocation, entry)
        assert observation.outcome == ShadowOutcome.MATCH, observation.mismatch
        return client

    def test_variant(self) -> None:
        with_notes = self.create_shadow_action("slack", {"notes": "Check the runbook"})
        without_notes = self.create_shadow_action("discord")

        cases = [
            (
                self.invocation(with_notes),
                "metric-alert:slack:critical:occurrence:notes:static",
            ),
            (
                self.resolution_invocation(with_notes),
                "metric-alert:slack:resolved:activity:notes:static",
            ),
            (
                self.invocation(without_notes),
                "metric-alert:discord:critical:occurrence:no_notes:static",
            ),
        ]
        for invocation, expected in cases:
            provider_key = SHADOW_PROVIDERS[invocation.action.type]
            assert _variant(invocation, NotificationSource.METRIC_ALERT, provider_key) == expected

    def test_warning_percent_variant(self) -> None:
        action = self.create_shadow_action("slack")
        event = self.event_data.event
        assert isinstance(event, GroupEvent) and event.occurrence is not None
        event.occurrence = replace(event.occurrence, priority=DetectorPriorityLevel.MEDIUM)
        self.detector.config = {**self.detector.config, "detection_type": "percent"}

        variant = _variant(
            self.invocation(action), NotificationSource.METRIC_ALERT, NotificationProviderKey.SLACK
        )
        assert variant == "metric-alert:slack:warning:occurrence:no_notes:percent"

    @contextmanager
    def occurrence_changed(self, **changes: Any) -> Generator[None]:
        event = self.event_data.event
        assert isinstance(event, GroupEvent) and event.occurrence is not None
        original = event.occurrence
        event.occurrence = replace(original, **changes)
        try:
            yield
        finally:
            event.occurrence = original

    @contextmanager
    def detector_config(self, **config: Any) -> Generator[None]:
        original = self.detector.config
        self.detector.config = {**original, **config}
        try:
            yield
        finally:
            self.detector.config = original

    @contextmanager
    def snuba_query_as(
        self, dataset: Dataset, query_type: SnubaQuery.Type, aggregate: str
    ) -> Generator[None]:
        original = (self.snuba_query.dataset, self.snuba_query.type, self.snuba_query.aggregate)
        self.snuba_query.update(dataset=dataset.value, type=query_type.value, aggregate=aggregate)
        try:
            yield
        finally:
            self.snuba_query.update(dataset=original[0], type=original[1], aggregate=original[2])

    @contextmanager
    def dynamic_detection(self) -> Generator[None]:
        with (
            self.detector_config(detection_type="dynamic"),
            self.occurrence_changed(evidence_data=asdict(self.anomaly_detection_evidence_data)),
        ):
            yield

    def test_variant_matrix_matches(self) -> None:
        """
        Every provider renders the same as legacy for each trigger status, detection type, and
        dataset, with and without notes.
        """
        datasets = {
            Dataset.Transactions: (SnubaQuery.Type.PERFORMANCE, "p95(transaction.duration)"),
            Dataset.PerformanceMetrics: (SnubaQuery.Type.PERFORMANCE, "p95(transaction.duration)"),
            Dataset.Metrics: (
                SnubaQuery.Type.CRASH_RATE,
                "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            ),
            Dataset.EventsAnalyticsPlatform: (SnubaQuery.Type.PERFORMANCE, "count(span.duration)"),
        }
        cases: dict[str, Callable[[], AbstractContextManager[object]]] = {
            "critical": nullcontext,
            "warning": partial(self.occurrence_changed, priority=DetectorPriorityLevel.MEDIUM),
            "percent": partial(
                self.detector_config, detection_type="percent", comparison_delta=3600
            ),
            "dynamic": self.dynamic_detection,
            **{
                dataset.value: partial(self.snuba_query_as, dataset, query_type, aggregate)
                for dataset, (query_type, aggregate) in datasets.items()
            },
        }
        failures = []
        variants = set()

        actions = [self.create_shadow_action("discord"), self.create_shadow_action("msteams")]
        with_notes = self.create_shadow_action("slack", {"notes": "Check the runbook"})
        actions += [
            with_notes,
            self.create_action(
                type="slack", integration_id=with_notes.integration_id, config=with_notes.config
            ),
        ]

        for action in actions:
            for name, case in cases.items():
                with case():
                    observation, _ = self.send(self.invocation(action))
                variants.add(observation.result_log["variant"])
                if observation.outcome != ShadowOutcome.MATCH:
                    failures.append((action.type, name, observation.outcome, observation.mismatch))

            observation, _ = self.send(
                self.resolution_invocation(action), execute_via_metric_alert_handler
            )
            variants.add(observation.result_log["variant"])
            if observation.outcome != ShadowOutcome.MATCH:
                failures.append(
                    (action.type, "resolved", observation.outcome, observation.mismatch)
                )

        assert failures == []
        parts = {part for variant in variants for part in variant.split(":")}
        assert {
            "critical",
            "warning",
            "resolved",
            "activity",
            "notes",
            "percent",
            "dynamic",
        } <= parts

    def test_slack_matches(self) -> None:
        action = self.create_shadow_action("slack", {"notes": "Check the runbook"})
        client = self.assert_match(self.invocation(action))
        client.return_value.chat_postMessage.assert_called_once()

    def test_slack_resolution_matches(self) -> None:
        action = self.create_shadow_action("slack", {"notes": "Check the runbook"})
        self.assert_match(self.resolution_invocation(action), execute_via_metric_alert_handler)

    @with_feature("organizations:metric-alert-chartcuterie")
    @mock.patch(
        "sentry.integrations.slack.utils.notifications.build_metric_alert_chart",
        return_value="https://chart.example",
    )
    def test_slack_compares_with_the_chart_that_was_sent(self, mock_chart: mock.MagicMock) -> None:
        action = self.create_shadow_action("slack")

        with mock.patch(
            "sentry.notifications.notification_action.utils.metric_alert_notification_data_factory",
            wraps=metric_alert_notification_data_factory,
        ) as factory:
            client = self.assert_match(self.invocation(action))

        mock_chart.assert_called_once()
        assert factory.call_args.kwargs["chart_url"] == "https://chart.example"
        attachments = client.return_value.chat_postMessage.call_args.kwargs["attachments"]
        assert "https://chart.example" in attachments

    def test_slack_staging_matches(self) -> None:
        action = self.create_shadow_action("slack_staging")

        self.assert_match(self.invocation(action))

    @mock.patch(f"{SLACK_METRIC_HANDLER}._send_via_notification_platform")
    @mock.patch(f"{SLACK_METRIC_HANDLER}.NotificationService.has_access", return_value=True)
    @mock.patch(f"{COMPARE_PATH}.NotificationService.render_template")
    def test_slack_sent_by_platform_is_not_compared(
        self,
        mock_render: mock.MagicMock,
        mock_has_access: mock.MagicMock,
        mock_platform_send: mock.MagicMock,
    ) -> None:
        action = self.create_shadow_action("slack")

        with mock.patch(
            "sentry.integrations.slack.utils.notifications._build_notification_payload"
        ) as mock_legacy_build:
            observation, client = self.send(self.invocation(action))

        mock_platform_send.assert_called_once()
        mock_legacy_build.assert_not_called()
        client.return_value.chat_postMessage.assert_not_called()
        mock_render.assert_not_called()
        assert observation.outcome == ShadowOutcome.LEGACY_NOT_CAPTURED

    def test_discord_matches(self) -> None:
        action = self.create_shadow_action("discord")
        client = self.assert_match(self.invocation(action))
        client.return_value.send_message.assert_called_once()

    def test_discord_resolution_matches(self) -> None:
        action = self.create_shadow_action("discord")
        self.assert_match(self.resolution_invocation(action), execute_via_metric_alert_handler)

    def test_msteams_matches(self) -> None:
        action = self.create_shadow_action("msteams")
        send = self.assert_match(self.invocation(action))
        send.assert_called_once()

    def test_msteams_resolution_matches(self) -> None:
        action = self.create_shadow_action("msteams")
        self.assert_match(self.resolution_invocation(action), execute_via_metric_alert_handler)

    def test_compares_when_the_send_raises(self) -> None:
        action = self.create_shadow_action("slack")
        error = RuntimeError("slack is down")

        with (
            observe_shadow() as observation,
            mock.patch(SLACK_METRIC_CLIENT) as client,
            pytest.raises(RuntimeError) as excinfo,
        ):
            client.return_value.chat_postMessage.side_effect = error
            execute_via_group_type_registry(self.invocation(action))

        assert excinfo.value is error
        assert observation.outcome == ShadowOutcome.MATCH, observation.mismatch
