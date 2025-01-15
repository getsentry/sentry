from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.db.models import Max, Q, prefetch_related_objects
from drf_spectacular.utils import extend_schema_serializer

from sentry import features
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.rule import RuleSerializer
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleActivity,
    AlertRuleActivityType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import Incident
from sentry.models.rule import Rule
from sentry.models.rulesnooze import RuleSnooze
from sentry.sentry_apps.models.sentry_app_installation import prepare_ui_component
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryAppComponentContext
from sentry.snuba.models import SnubaQueryEventType
from sentry.uptime.models import ProjectUptimeSubscription
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)


class AlertRuleSerializerResponseOptional(TypedDict, total=False):
    environment: str | None
    projects: list[str] | None
    queryType: int | None
    resolveThreshold: float | None
    dataset: str | None
    thresholdType: int | None
    eventTypes: list[str] | None
    owner: str | None
    originalAlertRuleId: str | None
    comparisonDelta: float | None
    weeklyAvg: float | None
    totalThisWeek: int | None
    snooze: bool | None
    latestIncident: datetime | None
    errors: list[str] | None
    sensitivity: str | None
    seasonality: str | None


@extend_schema_serializer(
    exclude_fields=[
        "status",
        "resolution",
        "thresholdPeriod",
        "weeklyAvg",
        "totalThisWeek",
        "latestIncident",
        "description",  # TODO: remove this once the feature has been released to add to the public docs, being sure to denote it will only display in Slack notifications
        "sensitivity",  # For anomaly detection, which is behind a feature flag
        "seasonality",  # For anomaly detection, which is behind a feature flag
        "detectionType",  # For anomaly detection, which is behind a feature flag
    ]
)
class AlertRuleSerializerResponse(AlertRuleSerializerResponseOptional):
    """
    This represents a Sentry Metric Alert Rule.
    """

    id: str
    name: str
    organizationId: str
    status: int
    query: str
    aggregate: str
    timeWindow: float
    resolution: float
    thresholdPeriod: int
    triggers: list[dict]
    dateModified: datetime
    dateCreated: datetime
    createdBy: dict
    description: str
    detectionType: str


@register(AlertRule)
class AlertRuleSerializer(Serializer):
    """
    Serializer for returning an alert rule to the client
    """

    def __init__(self, expand: list[str] | None = None, prepare_component_fields: bool = False):
        self.expand = expand or []
        self.prepare_component_fields = prepare_component_fields

    def get_attrs(
        self, item_list: Sequence[Any], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> defaultdict[AlertRule, Any]:
        alert_rules = {item.id: item for item in item_list}
        prefetch_related_objects(item_list, "snuba_query__environment")

        result: defaultdict[AlertRule, dict[str, Any]] = defaultdict(dict)
        triggers = AlertRuleTrigger.objects.filter(alert_rule__in=item_list).order_by("label")
        serialized_triggers = serialize(list(triggers), **kwargs)

        trigger_actions = AlertRuleTriggerAction.objects.filter(
            alert_rule_trigger__alert_rule_id__in=alert_rules.keys()
        ).exclude(Q(sentry_app_config__isnull=True) | Q(sentry_app_id__isnull=True))

        sentry_app_installations_by_sentry_app_id: Mapping[str, RpcSentryAppComponentContext] = {}
        organization_ids = list({alert_rule.organization_id for alert_rule in alert_rules.values()})
        if self.prepare_component_fields:
            sentry_app_ids = list(trigger_actions.values_list("sentry_app_id", flat=True))
            install_contexts = app_service.get_component_contexts(
                filter={"app_ids": sentry_app_ids, "organization_id": organization_ids[0]},
                component_type="alert-rule-action",
            )
            sentry_app_installations_by_sentry_app_id = {
                str(context.installation.sentry_app.id): context
                for context in install_contexts
                if context.installation.sentry_app
            }

        for trigger, serialized in zip(triggers, serialized_triggers):
            errors = []
            alert_rule = alert_rules[trigger.alert_rule_id]
            alert_rule_triggers = result[alert_rule].setdefault("triggers", [])
            for action in serialized.get("actions", []):
                if action is None:
                    continue

                # Prepare AlertRuleTriggerActions that are SentryApp components
                install_context = None
                sentry_app_id = str(action.get("sentryAppId"))
                if sentry_app_id:
                    install_context = sentry_app_installations_by_sentry_app_id.get(sentry_app_id)
                if install_context:
                    rpc_install = install_context.installation
                    rpc_component = install_context.component
                    rpc_app = rpc_install.sentry_app
                    assert rpc_app

                    action["sentryAppInstallationUuid"] = rpc_install.uuid

                    component = prepare_ui_component(
                        rpc_install,
                        rpc_component,
                        None,
                        action.get("settings"),
                    )
                    if component is None:
                        errors.append({"detail": f"Could not fetch details from {rpc_app.name}"})
                        action["disabled"] = True
                        continue

                    action["formFields"] = component.app_schema.get("settings", {})

            if errors:
                result[alert_rule]["errors"] = errors
            alert_rule_triggers.append(serialized)

        alert_rule_projects = set()
        for alert_rule in alert_rules.values():
            if alert_rule.projects.exists():
                for project in alert_rule.projects.all():
                    alert_rule_projects.add((alert_rule.id, project.slug))

        snuba_alert_rule_projects = AlertRule.objects.filter(
            id__in=[item.id for item in item_list]
        ).values_list("id", "projects__slug")

        alert_rule_projects.update(
            [(id, project_slug) for id, project_slug in snuba_alert_rule_projects if project_slug]
        )

        for alert_rule_id, project_slug in alert_rule_projects:
            rule_result = result[alert_rules[alert_rule_id]].setdefault("projects", [])
            rule_result.append(project_slug)

        rule_activities = list(
            AlertRuleActivity.objects.filter(
                alert_rule__in=item_list, type=AlertRuleActivityType.CREATED.value
            )
        )

        user_by_user_id: MutableMapping[int, RpcUser] = {
            user.id: user
            for user in user_service.get_many_by_id(
                ids=[r.user_id for r in rule_activities if r.user_id is not None]
            )
        }
        for rule_activity in rule_activities:
            if rule_activity.user_id is not None:
                rpc_user = user_by_user_id.get(rule_activity.user_id)
            else:
                rpc_user = None
            if rpc_user:
                created_by = dict(
                    id=rpc_user.id, name=rpc_user.get_display_name(), email=rpc_user.email
                )
            else:
                created_by = None
            result[alert_rules[rule_activity.alert_rule_id]]["created_by"] = created_by

        for item in item_list:
            if item.user_id or item.team_id:
                actor = item.owner
                if actor:
                    result[item]["owner"] = actor.identifier

        if "original_alert_rule" in self.expand:
            snapshot_activities = AlertRuleActivity.objects.filter(
                alert_rule__in=item_list,
                type=AlertRuleActivityType.SNAPSHOT.value,
            )
            for activity in snapshot_activities:
                result[alert_rules[activity.alert_rule_id]][
                    "originalAlertRuleId"
                ] = activity.previous_alert_rule_id

        if "latestIncident" in self.expand:
            incident_map = {}
            for incident in Incident.objects.filter(
                id__in=Incident.objects.filter(alert_rule__in=alert_rules)
                .values("alert_rule_id")
                .annotate(incident_id=Max("id"))
                .values("incident_id")
            ):
                incident_map[incident.alert_rule_id] = serialize(incident, user=user)
            for alert_rule in alert_rules.values():
                result[alert_rule]["latestIncident"] = incident_map.get(alert_rule.id, None)
        return result

    def serialize(
        self,
        obj: AlertRule,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AlertRuleSerializerResponse:
        from sentry.incidents.endpoints.utils import translate_threshold
        from sentry.incidents.logic import translate_aggregate_field

        assert obj.snuba_query is not None
        env = obj.snuba_query.environment
        allow_mri = features.has(
            "organizations:custom-metrics",
            obj.organization,
            actor=user,
        ) or features.has(
            "organizations:insights-alerts",
            obj.organization,
            actor=user,
        )
        # Temporary: Translate aggregate back here from `tags[sentry:user]` to `user` for the frontend.
        aggregate = translate_aggregate_field(
            obj.snuba_query.aggregate, reverse=True, allow_mri=allow_mri
        )

        data: AlertRuleSerializerResponse = {
            "id": str(obj.id),
            "name": obj.name,
            "organizationId": str(obj.organization_id),
            "status": obj.status,
            "queryType": obj.snuba_query.type,
            "dataset": obj.snuba_query.dataset,
            "query": obj.snuba_query.query,
            "aggregate": aggregate,
            "thresholdType": obj.threshold_type,
            "resolveThreshold": translate_threshold(obj, obj.resolve_threshold),
            # TODO: Start having the frontend expect seconds
            "timeWindow": obj.snuba_query.time_window / 60,
            "environment": env.name if env else None,
            # TODO: Start having the frontend expect seconds
            "resolution": obj.snuba_query.resolution / 60,
            "thresholdPeriod": obj.threshold_period,
            "triggers": attrs.get("triggers", []),
            "projects": sorted(attrs.get("projects", [])),
            "owner": attrs.get("owner", None),
            "originalAlertRuleId": attrs.get("originalAlertRuleId", None),
            "comparisonDelta": obj.comparison_delta / 60 if obj.comparison_delta else None,
            "dateModified": obj.date_modified,
            "dateCreated": obj.date_added,
            "createdBy": attrs.get("created_by", None),
            "description": obj.description if obj.description is not None else "",
            "sensitivity": obj.sensitivity,
            "seasonality": obj.seasonality,
            "detectionType": obj.detection_type,
        }
        rule_snooze = RuleSnooze.objects.filter(
            Q(user_id=user.id) | Q(user_id=None), alert_rule=obj
        )
        if rule_snooze.exists():
            data["snooze"] = True

        if "latestIncident" in self.expand:
            data["latestIncident"] = attrs.get("latestIncident", None)
        if "errors" in attrs:
            data["errors"] = attrs["errors"]

        return data


class DetailedAlertRuleSerializer(AlertRuleSerializer):
    def get_attrs(
        self, item_list: Sequence[Any], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> defaultdict[AlertRule, Any]:
        result = super().get_attrs(item_list, user, **kwargs)
        query_to_alert_rule = {ar.snuba_query_id: ar for ar in item_list}

        for event_type in SnubaQueryEventType.objects.filter(
            snuba_query_id__in=[item.snuba_query_id for item in item_list]
        ):
            event_types = result[query_to_alert_rule[event_type.snuba_query_id]].setdefault(
                "event_types", []
            )
            event_types.append(SnubaQueryEventType.EventType(event_type.type).name.lower())

        return result

    def serialize(
        self,
        obj: AlertRule,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs,
    ) -> AlertRuleSerializerResponse:
        data = super().serialize(obj, attrs, user)
        data["eventTypes"] = sorted(attrs.get("event_types", []))
        data["snooze"] = False
        return data


class CombinedRuleSerializer(Serializer):
    def __init__(self, expand: list[str] | None = None):
        self.expand = expand or []

    def get_attrs(
        self, item_list: Sequence[Any], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        results = super().get_attrs(item_list, user)

        alert_rules = [x for x in item_list if isinstance(x, AlertRule)]
        incident_map = {}
        if "latestIncident" in self.expand:
            for incident in Incident.objects.filter(id__in=[x.incident_id for x in alert_rules]):  # type: ignore[attr-defined]
                incident_map[incident.id] = serialize(incident, user=user)

        serialized_alert_rules = serialize(alert_rules, user=user)
        serialized_alert_rule_map_by_id = {
            serialized_alert["id"]: serialized_alert for serialized_alert in serialized_alert_rules
        }

        serialized_issue_rules = serialize(
            [x for x in item_list if isinstance(x, Rule)],
            user=user,
            serializer=RuleSerializer(expand=self.expand),
        )
        serialized_issue_rule_map_by_id = {
            serialized_rule["id"]: serialized_rule for serialized_rule in serialized_issue_rules
        }

        serialized_uptime_monitors = serialize(
            [x for x in item_list if isinstance(x, ProjectUptimeSubscription)],
            user=user,
        )
        serialized_uptime_monitor_map_by_id = {
            item["id"]: item for item in serialized_uptime_monitors
        }

        for item in item_list:
            item_id = str(item.id)
            if isinstance(item, AlertRule) and item_id in serialized_alert_rule_map_by_id:
                # This is a metric alert rule
                serialized_alert_rule = serialized_alert_rule_map_by_id[item_id]
                if "latestIncident" in self.expand:
                    # Eg. we _have_ an incident
                    try:
                        serialized_alert_rule["latestIncident"] = incident_map.get(item.incident_id)  # type: ignore[attr-defined]
                    except AttributeError as e:
                        logger.exception(
                            "incident serialization error",
                            extra={
                                "exception": e,
                                "alert_rule_id": item_id,
                                "is_metric_alert": isinstance(item, AlertRule),
                                "is_issue_alert": isinstance(item, Rule),
                            },
                        )
                results[item] = serialized_alert_rule
            elif isinstance(item, Rule) and item_id in serialized_issue_rule_map_by_id:
                # This is an issue alert rule
                results[item] = serialized_issue_rule_map_by_id[item_id]
            elif (
                isinstance(item, ProjectUptimeSubscription)
                and item_id in serialized_uptime_monitor_map_by_id
            ):
                # This is an uptime monitor
                results[item] = serialized_uptime_monitor_map_by_id[item_id]
            else:
                logger.error(
                    "Alert Rule found but dropped during serialization",
                    extra={
                        "id": item_id,
                        "issue_rule": isinstance(item, Rule),
                        "metric_rule": isinstance(item, AlertRule),
                    },
                )

        return results

    def serialize(
        self,
        obj: Rule | AlertRule | ProjectUptimeSubscription,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[Any, Any]:
        updated_attrs = {**attrs}
        if isinstance(obj, AlertRule):
            updated_attrs["type"] = "alert_rule"
        elif isinstance(obj, Rule):
            updated_attrs["type"] = "rule"
        elif isinstance(obj, ProjectUptimeSubscription):
            updated_attrs["type"] = "uptime"
        else:
            raise AssertionError(f"Invalid rule to serialize: {type(obj)}")
        return updated_attrs
