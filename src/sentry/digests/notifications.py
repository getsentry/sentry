from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any, NamedTuple, TypeAlias

import sentry_sdk

from sentry import features, tsdb
from sentry.digests.types import IdentifierKey, Notification, Record, RecordWithRuleObjects
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.notifications.utils.rules import get_key_from_rule_data
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.tsdb.base import TSDBModel
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.models.alertrule_workflow import AlertRuleWorkflow

logger = logging.getLogger("sentry.digests")

Digest: TypeAlias = dict[Rule, dict[Group, list[RecordWithRuleObjects]]]


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
    event: Event | GroupEvent, rules: Sequence[Rule], notification_uuid: str | None = None
) -> Record:
    from sentry.notifications.notification_action.utils import should_fire_workflow_actions

    if not rules:
        logger.warning("Creating record for %s that does not contain any rules!", event)

    # TODO(iamrajjoshi): The typing on this function is wrong, the type should be GroupEvent
    # TODO(iamrajjoshi): Creating a PR to fix this
    assert event.group is not None
    rule_ids = []
    identifier_key = IdentifierKey.RULE
    if features.has("organizations:workflow-engine-ui-links", event.organization):
        identifier_key = IdentifierKey.WORKFLOW
        for rule in rules:
            rule_ids.append(int(get_key_from_rule_data(rule, "workflow_id")))
    elif should_fire_workflow_actions(event.organization, event.group.type):
        for rule in rules:
            rule_ids.append(int(get_key_from_rule_data(rule, "legacy_rule_id")))
    else:
        for rule in rules:
            rule_ids.append(rule.id)
    return Record(
        event.event_id,
        Notification(event, rule_ids, notification_uuid, identifier_key),
        event.datetime.timestamp(),
    )


def _bind_records(
    records: Sequence[Record], groups: dict[int, Group], rules: dict[int, Rule]
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
    records: Sequence[RecordWithRuleObjects], groups: dict[int, Group], rules: dict[int, Rule]
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
    rules: dict[int, Rule],
    event_counts: dict[int, int],
    user_counts: Mapping[Any, int],
) -> Digest:
    # sans-io implementation details
    bound_records = _bind_records(records, groups, rules)
    grouped = _group_records(bound_records, groups, rules)
    return _sort_digest(grouped, event_counts=event_counts, user_counts=user_counts)


def get_rules_from_workflows(project: Project, workflow_ids: set[int]) -> dict[int, Rule]:

    rules: dict[int, Rule] = {}
    if not workflow_ids:
        return rules

    # Fetch all workflows in bulk
    workflows = Workflow.objects.filter(organization_id=project.organization_id).in_bulk(
        workflow_ids
    )

    # We are only processing the workflows in the digest if under the new flag
    # This should be ok since we should only add workflow_ids to redis when under this flag
    if features.has("organizations:workflow-engine-ui-links", project.organization):
        for workflow_id, workflow in workflows.items():
            assert (
                workflow.organization_id == project.organization_id
            ), "Workflow must belong to Organization"
            rules[workflow_id] = Rule(
                label=workflow.name,
                id=workflow_id,
                project_id=project.id,
                # We need to do this so that the links are built correctly downstream
                data={"actions": [{"workflow_id": workflow_id}]},
            )
    # This is if we had workflows in the digest but the flag is not enabled
    # This can happen if we rollback the flag, but the records in the digest aren't flushed
    else:
        alert_rule_workflows = AlertRuleWorkflow.objects.filter(workflow_id__in=workflow_ids)
        alert_rule_workflows_map = {awf.workflow_id: awf for awf in alert_rule_workflows}

        rule_ids_to_fetch = {awf.rule_id for awf in alert_rule_workflows}

        bulk_rules = Rule.objects.filter(project_id=project.id).in_bulk(rule_ids_to_fetch)

        for workflow_id in workflow_ids:
            alert_workflow = alert_rule_workflows_map.get(workflow_id)
            if not alert_workflow:
                logger.warning(
                    "Workflow %s does not have a corresponding AlertRuleWorkflow entry", workflow_id
                )
                raise

            rule = bulk_rules.get(alert_workflow.rule_id)
            if not rule:
                logger.warning(
                    "Rule %s linked to Workflow %s not found or does not belong to project %s",
                    alert_workflow.rule_id,
                    workflow_id,
                    project.id,
                )
                continue

            assert rule.project_id == project.id, "Rule must belong to Project"

            try:
                rule.data["actions"][0]["legacy_rule_id"] = rule.id
            except KeyError:
                # This shouldn't happen, but isn't a deal breaker if it does
                sentry_sdk.capture_exception(
                    Exception(f"Rule {rule.id} does not have a legacy_rule_id"),
                    level="warning",
                )

            rules[workflow_id] = rule
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
    rules = Rule.objects.in_bulk(rule_ids)

    for rule in rules.values():
        try:
            rule.data["actions"][0]["legacy_rule_id"] = rule.id
        except KeyError:
            # This shouldn't happen, but isn't a deal breaker if it does
            sentry_sdk.capture_exception(
                Exception(f"Rule {rule.id} does not have a legacy_rule_id"),
                level="warning",
            )

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
