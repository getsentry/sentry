from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any, Literal, TypedDict

from django.db.models import Q, prefetch_related_objects
from rest_framework import serializers

from sentry.api.serializers import Serializer, register
from sentry.constants import ObjectStatus
from sentry.models.environment import Environment
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.models.rulesnooze import RuleSnooze
from sentry.sentry_apps.models.sentry_app_installation import prepare_ui_component
from sentry.sentry_apps.services.app.model import RpcSentryAppComponentContext
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.models import AlertRuleWorkflow
from sentry.workflow_engine.processors.workflow_fire_history import get_last_fired_dates
from sentry.workflow_engine.typings.notification_action import (
    ActionTargetType,
    FallthroughChoiceType,
)

EMAIL_ACTION = "sentry.mail.actions.NotifyEmailAction"


def generate_rule_label(project, rule, data):
    from sentry.rules import rules

    rule_cls = rules.get(data["id"])
    if rule_cls is None:
        return

    rule_inst = rule_cls(project=project, data=data, rule=rule)
    return rule_inst.render_label()


def _is_filter(data):
    from sentry.rules import rules

    rule_cls = rules.get(data["id"])
    return rule_cls is not None and rule_cls.rule_type == "filter/event"


class RuleCreatedBy(TypedDict):
    id: int
    name: str
    email: str


class _ErrorDict(TypedDict):
    detail: str


class RuleSerializerResponseOptional(TypedDict, total=False):
    owner: str | None
    createdBy: RuleCreatedBy | None
    environment: str | None
    lastTriggered: str | None
    snoozeCreatedBy: str | None
    snoozeForEveryone: bool | None
    disableReason: str
    disableDate: str
    errors: list[_ErrorDict]


class RuleSerializerResponse(RuleSerializerResponseOptional):
    """
    This represents a Sentry Rule.
    """

    id: str | None
    conditions: list[dict]
    filters: list[dict]
    actions: list[dict]
    actionMatch: str | None
    filterMatch: str | None
    frequency: int
    name: str
    dateCreated: datetime
    projects: list[str]
    status: Literal["active", "disabled"]
    snooze: bool


@register(Rule)
class RuleSerializer(Serializer[RuleSerializerResponse]):
    def __init__(
        self,
        expand: list[str] | None = None,
        prepare_component_fields: bool = False,
        project_slug: str | None = None,
    ):
        super().__init__()
        self.expand = expand or []
        self.prepare_component_fields = prepare_component_fields
        self.project_slug = project_slug

    def get_attrs(self, item_list, user, **kwargs):
        from sentry.sentry_apps.services.app import app_service

        prefetch_related_objects(item_list, "project")

        environments = Environment.objects.in_bulk(
            [_f for _f in [i.environment_id for i in item_list] if _f]
        )

        result: dict[Rule, dict[str, Any]]
        result = {i: {"environment": environments.get(i.environment_id)} for i in item_list}
        ras = list(
            RuleActivity.objects.filter(
                rule__in=item_list, type=RuleActivityType.CREATED.value
            ).select_related("rule")
        )

        users = {
            u.id: u
            for u in user_service.get_many_by_id(
                ids=[ra.user_id for ra in ras if ra.user_id is not None]
            )
        }

        for rule_activity in ras:
            if rule_activity.user_id is None:
                creator = None
            else:
                u = users.get(rule_activity.user_id)
                if u:
                    creator = {
                        "id": u.id,
                        "name": u.get_display_name(),
                        "email": u.email,
                    }
                else:
                    creator = None

            result[rule_activity.rule].update({"created_by": creator})

        rules = {item.id: item for item in item_list}

        sentry_app_installations_by_uuid: Mapping[str, RpcSentryAppComponentContext] = {}
        if self.prepare_component_fields:
            sentry_app_uuids = [
                sentry_app_uuid
                for sentry_app_uuid in (
                    action.get("sentryAppInstallationUuid")
                    for rule in rules.values()
                    for action in rule.data.get("actions", [])
                )
                if sentry_app_uuid is not None
            ]
            install_contexts = app_service.get_component_contexts(
                filter={"uuids": sentry_app_uuids}, component_type="alert-rule-action"
            )
            sentry_app_installations_by_uuid = {
                install_context.installation.uuid: install_context
                for install_context in install_contexts
            }

        for rule in rules.values():
            actor = rule.owner
            if actor:
                result[rule]["owner"] = actor.identifier

            errors = []
            for action in rule.data.get("actions", []):
                install_context = sentry_app_installations_by_uuid.get(
                    str(action.get("sentryAppInstallationUuid"))
                )
                if install_context:
                    rpc_install = install_context.installation
                    rpc_component = install_context.component
                    rpc_app = rpc_install.sentry_app
                    component = (
                        prepare_ui_component(
                            rpc_install,
                            rpc_component,
                            self.project_slug,
                            action.get("settings"),
                        )
                        if rpc_component
                        else None
                    )
                    if component is None:
                        errors.append({"detail": f"Could not fetch details from {rpc_app.name}"})
                        action["disabled"] = True
                        continue

                    action["formFields"] = component.app_schema.get("settings", {})

            if len(errors):
                result[rule]["errors"] = errors

        if "lastTriggered" in self.expand:
            last_triggered_lookup: dict[int, datetime] = {}
            if item_list:
                rule_ids = [rule.id for rule in item_list]
                org_ids = {rule.project.organization_id for rule in item_list}
                workflow_rule_lookup = dict(
                    AlertRuleWorkflow.objects.filter(
                        rule_id__in=rule_ids,
                        workflow__organization_id__in=org_ids,
                    ).values_list("workflow_id", "rule_id")
                )

                workflow_fire_dates = get_last_fired_dates(list(workflow_rule_lookup.keys()))

                for workflow_id, last_fire in workflow_fire_dates.items():
                    rule_id = workflow_rule_lookup.get(workflow_id)
                    if rule_id and last_fire:
                        last_triggered_lookup[rule_id] = last_fire

            for rule in item_list:
                result[rule]["last_triggered"] = last_triggered_lookup.get(rule.id, None)

        rule_snooze_lookup = {
            snooze["rule_id"]: {"user_id": snooze["user_id"], "owner_id": snooze["owner_id"]}
            for snooze in RuleSnooze.objects.filter(
                Q(user_id=user.id) | Q(user_id=None),
                rule__in=[item.id for item in item_list],
            ).values("rule_id", "user_id", "owner_id")
        }

        for rule in item_list:
            snooze = rule_snooze_lookup.get(rule.id, None)
            if snooze:
                result[rule]["snooze"] = snooze

        return result

    def serialize(self, obj, attrs, user, **kwargs) -> RuleSerializerResponse:
        from sentry.rules.conditions.event_frequency import EventFrequencyPercentCondition
        # imported here due to circular dependency

        environment = attrs["environment"]
        all_conditions = []
        for o in obj.data.get("conditions", []):
            normalized_data_condition = dict(o)
            # EventFrequencyPercentCondition stores float values (e.g. 100.0), but its
            # label renders integer values without a decimal suffix.
            normalized_value = normalized_data_condition.get("value")
            if (
                normalized_data_condition.get("id") == EventFrequencyPercentCondition.id
                and isinstance(normalized_value, float)
                and normalized_value.is_integer()
            ):
                normalized_data_condition["value"] = int(normalized_value)
            all_conditions.append(
                dict(
                    list(normalized_data_condition.items())
                    + [("name", generate_rule_label(obj.project, obj, normalized_data_condition))]
                )
            )

        actions = []
        for action in obj.data.get("actions", []):
            try:
                action_data = dict(
                    list(action.items()) + [("name", generate_rule_label(obj.project, obj, action))]
                )
                # Normalize email Member/Team action fields for the API response.
                if action_data.get("id") == EMAIL_ACTION and action_data.get("targetType") in (
                    ActionTargetType.MEMBER.value,
                    ActionTargetType.TEAM.value,
                ):
                    if action_data.get("targetIdentifier") is not None:
                        action_data["targetIdentifier"] = str(action_data["targetIdentifier"])
                    if "fallthroughType" not in action_data:
                        action_data["fallthroughType"] = FallthroughChoiceType.ACTIVE_MEMBERS.value
                # IssueOwners email actions also emit a default fallthroughType.
                elif (
                    action_data.get("id") == EMAIL_ACTION
                    and action_data.get("targetType") == ActionTargetType.ISSUE_OWNERS.value
                    and "fallthroughType" not in action_data
                ):
                    action_data["fallthroughType"] = FallthroughChoiceType.ACTIVE_MEMBERS.value
                actions.append(action_data)
            except serializers.ValidationError:
                # Integrations can be deleted and we don't want to fail to load the rule
                pass

        d: RuleSerializerResponse = {
            # XXX(dcramer): we currently serialize unsaved rule objects
            # as part of the rule editor
            "id": str(obj.id) if obj.id else None,
            # conditions pertain to criteria that can trigger an alert
            "conditions": list(filter(lambda condition: not _is_filter(condition), all_conditions)),
            # filters are not new conditions but are the subset of conditions that pertain to event attributes
            "filters": list(filter(lambda condition: _is_filter(condition), all_conditions)),
            "actions": actions,
            "actionMatch": obj.data.get("action_match") or Rule.DEFAULT_CONDITION_MATCH,
            "filterMatch": obj.data.get("filter_match") or Rule.DEFAULT_FILTER_MATCH,
            "frequency": obj.data.get("frequency") or Rule.DEFAULT_FREQUENCY,
            "name": obj.label,
            "dateCreated": obj.date_added,
            "owner": attrs.get("owner", None),
            "createdBy": attrs.get("created_by", None),
            "environment": environment.name if environment is not None else None,
            "projects": [obj.project.slug],
            "status": "active" if obj.status == ObjectStatus.ACTIVE else "disabled",
            "snooze": "snooze" in attrs,
        }
        if "last_triggered" in attrs:
            d["lastTriggered"] = attrs["last_triggered"]

        if "errors" in attrs:
            d["errors"] = attrs["errors"]

        if "snooze" in attrs:
            snooze = attrs["snooze"]
            created_by = None
            if user.id == snooze.get("owner_id"):
                created_by = "You"
            elif owner_id := snooze.get("owner_id"):
                creator = user_service.get_user(owner_id)
                if creator:
                    created_by = creator.get_display_name()

            if created_by is not None:
                d["snoozeCreatedBy"] = created_by
                d["snoozeForEveryone"] = snooze.get("user_id") is None

        if "disable_date" in attrs:
            d["disableReason"] = "noisy"
            d["disableDate"] = attrs["disable_date"]

        return d
