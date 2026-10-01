from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import replace
from typing import Any, NamedTuple, TypeAlias

from sentry import tsdb
from sentry.digests.types import IdentifierKey, Notification, Record, RecordWithRuleObjects
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType, NotificationRule
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.tsdb.base import TSDBModel
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.models.alertrule_workflow import AlertRuleWorkflow

logger = logging.getLogger("sentry.digests")

Digest: TypeAlias = dict[NotificationRule, dict[Group, list[RecordWithRuleObjects]]]


class DigestInfo(NamedTuple):
    digest: Digest
    event_counts: dict[int, int]
    user_counts: Mapping[int, int]


def split_key(
    key: str,
) -> tuple[Project, ActionTargetType, int | str | None, FallthroughChoiceType | None]:
    key_parts = key.split(":", 5)
    project_id = key_parts[2]
    # XXX: We transitioned to new style keys (len == 5) a while ago on
    # sentry.io. But self-hosted users might transition at any time, so we need
    # to keep this transition code around for a while, maybe indefinitely.
    target_identifier: int | str | None = None
    if len(key_parts) == 6:
        target_type = ActionTargetType(key_parts[3])
        if key_parts[4]:
            if key_parts[4] == "None":
                target_identifier = key_parts[4]
            else:
                target_identifier = int(key_parts[4])
        try:
            fallthrough_choice = FallthroughChoiceType(key_parts[5])
        except ValueError:
            fallthrough_choice = None
    elif len(key_parts) == 5:
        target_type = ActionTargetType(key_parts[3])
        if key_parts[4]:
            if key_parts[4] == "None":
                target_identifier = key_parts[4]
            else:
                target_identifier = int(key_parts[4])
        fallthrough_choice = None
    else:
        target_type = ActionTargetType.ISSUE_OWNERS
        target_identifier = None
        fallthrough_choice = None
    return Project.objects.get(pk=project_id), target_type, target_identifier, fallthrough_choice


def unsplit_key(
    project: Project,
    target_type: ActionTargetType,
    target_identifier: int | None,
    fallthrough_choice: FallthroughChoiceType | None,
) -> str:
    target_str = target_identifier if target_identifier is not None else ""
    fallthrough = fallthrough_choice.value if fallthrough_choice is not None else ""
    return f"mail:p:{project.id}:{target_type.value}:{target_str}:{fallthrough}"


def event_to_record(
    event: Event | GroupEvent,
    rules: Sequence[Rule | NotificationRule],
    notification_uuid: str | None = None,
    identifier_key: IdentifierKey = IdentifierKey.RULE,
) -> Record:
    if not rules:
        logger.warning("Creating record for %s that does not contain any rules!", event)

    # TODO(iamrajjoshi): The typing on this function is wrong, the type should be GroupEvent
    # TODO(iamrajjoshi): Creating a PR to fix this
    assert event.group is not None
    rule_ids = []
    for rule in rules:
        if isinstance(rule, Rule):
            rule = NotificationRule.from_deprecated_legacy_rule(rule)
        rule_id = rule.legacy_rule_id if identifier_key == IdentifierKey.RULE else rule.workflow_id
        assert rule_id is not None
        rule_ids.append(rule_id)
    return Record(
        event.event_id,
        Notification(event, rule_ids, notification_uuid, identifier_key),
        event.datetime.timestamp(),
    )


def _bind_records(
    records: Sequence[Record], groups: dict[int, Group], rules: dict[int, NotificationRule]
) -> list[RecordWithRuleObjects]:
    ret = []
    for record in records:
        if record.value.event.group_id is None:
            continue
        group = groups.get(record.value.event.group_id)
        if group is None:
            logger.debug("%s could not be associated with a group.", record)
            continue
        elif group.get_status() != GroupStatus.UNRESOLVED:
            continue

        record.value.event.group = group

        record_rules = [
            rule
            for rule in (rules.get(rule_id) for rule_id in record.value.rules)
            if rule is not None
        ]
        ret.append(record.with_rules(record_rules))

    return ret


def _group_records(
    records: Sequence[RecordWithRuleObjects],
    groups: dict[int, Group],
    rules: dict[int, NotificationRule],
) -> Digest:
    grouped: Digest = defaultdict(lambda: defaultdict(list))
    for record in records:
        assert record.value.event.group is not None
        for rule in record.value.rules:
            grouped[rule][record.value.event.group].append(record)
    return grouped


def _sort_digest(
    digest: Digest, event_counts: dict[int, int], user_counts: Mapping[Any, int]
) -> Digest:
    # sort inner groups dict by (event_count, user_count) descending
    for key, rule_groups in digest.items():
        digest[key] = dict(
            sorted(
                rule_groups.items(),
                # x = (group, records)
                key=lambda x: (event_counts[x[0].id], user_counts[x[0].id]),
                reverse=True,
            )
        )

    # sort outer rules dict by number of groups (descending)
    return dict(
        sorted(
            digest.items(),
            # x = (rule, groups)
            key=lambda x: len(x[1]),
            reverse=True,
        )
    )


def _build_digest_impl(
    records: Sequence[Record],
    groups: dict[int, Group],
    rules: dict[int, NotificationRule],
    event_counts: dict[int, int],
    user_counts: Mapping[Any, int],
) -> Digest:
    # sans-io implementation details
    bound_records = _bind_records(records, groups, rules)
    grouped = _group_records(bound_records, groups, rules)
    return _sort_digest(grouped, event_counts=event_counts, user_counts=user_counts)


def get_rules_from_workflows(
    project: Project, workflow_ids: set[int]
) -> dict[int, NotificationRule]:
    rules: dict[int, NotificationRule] = {}
    if not workflow_ids:
        return rules

    # Fetch all workflows in bulk
    workflows = Workflow.objects.filter(organization_id=project.organization_id).in_bulk(
        workflow_ids
    )

    # Try to fetch rules for workflows, if not use the workflow id
    alert_rule_workflows = AlertRuleWorkflow.objects.filter(workflow_id__in=workflow_ids)
    alert_rule_workflows_map = {awf.workflow_id: awf for awf in alert_rule_workflows}

    rule_ids_to_fetch = {awf.rule_id for awf in alert_rule_workflows}

    bulk_rules = Rule.objects.filter(project_id=project.id).in_bulk(rule_ids_to_fetch)

    for workflow_id, workflow in workflows.items():
        alert_workflow = alert_rule_workflows_map.get(workflow_id)
        if alert_workflow:
            if rule := bulk_rules.get(alert_workflow.rule_id):
                assert rule.project_id == project.id, "Rule must belong to Project"
                rules[workflow_id] = replace(
                    NotificationRule.from_deprecated_legacy_rule(
                        rule, workflow_id=workflow_id
                    ),
                    environment_id=workflow.environment_id,
                )
                continue

        rules[workflow_id] = NotificationRule(
            label=workflow.name,
            id=workflow_id,
            project=project,
            environment_id=workflow.environment_id,
            data={"actions": [{"workflow_id": workflow_id}]},
            workflow_id=workflow_id,
            legacy_rule_id=None,
        )

    return rules


def build_digest(project: Project, records: Sequence[Record]) -> DigestInfo:
    if not records:
        return DigestInfo({}, {}, {})

    # This reads a little strange, but remember that records are returned in
    # reverse chronological order, and we query the database in chronological
    # order.
    # NOTE: This doesn't account for any issues that are filtered out later.
    start = records[-1].datetime
    end = records[0].datetime

    rule_ids: set[int] = set()
    workflow_ids: set[int] = set()

    for record in records:
        identifier_key = getattr(record.value, "identifier_key", IdentifierKey.RULE)
        # record.value is Notification, record.value.rules is Sequence[int]
        ids_to_add = record.value.rules
        if identifier_key == IdentifierKey.RULE:
            rule_ids.update(ids_to_add)
        elif identifier_key == IdentifierKey.WORKFLOW:
            workflow_ids.update(ids_to_add)

    groups = Group.objects.in_bulk(record.value.event.group_id for record in records)
    group_ids = list(groups)
    rules = {
        rule_id: NotificationRule.from_deprecated_legacy_rule(rule)
        for rule_id, rule in Rule.objects.in_bulk(rule_ids).items()
    }

    rules.update(get_rules_from_workflows(project, workflow_ids))

    for group_id, g in groups.items():
        assert g.project_id == project.id, "Group must belong to Project"

    tenant_ids = {"organization_id": project.organization_id}
    event_counts = tsdb.backend.get_timeseries_sums(
        TSDBModel.group,
        group_ids,
        start,
        end,
        tenant_ids=tenant_ids,
    )
    user_counts = tsdb.backend.get_distinct_counts_totals(
        TSDBModel.users_affected_by_group,
        group_ids,
        start,
        end,
        tenant_ids=tenant_ids,
    )
    digest = _build_digest_impl(records, groups, rules, event_counts, user_counts)

    return DigestInfo(digest, event_counts, user_counts)
