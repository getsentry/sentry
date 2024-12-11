from __future__ import annotations

import logging
import operator
from collections.abc import Sequence
from copy import deepcopy
from datetime import datetime, timedelta
from typing import TypeVar, cast

from django.conf import settings
from django.db import router, transaction
from django.utils import timezone
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster
from snuba_sdk import Column, Condition, Limit, Op

from sentry import features
from sentry.incidents.logic import (
    CRITICAL_TRIGGER_LABEL,
    WARNING_TRIGGER_LABEL,
    create_incident,
    deduplicate_trigger_actions,
    update_incident_status,
)
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleMonitorTypeInt,
    AlertRuleStatus,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerActionMethod,
    invoke_alert_subscription_callback,
)
from sentry.incidents.models.alert_rule_activations import AlertRuleActivations
from sentry.incidents.models.incident import (
    Incident,
    IncidentActivity,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.incidents.tasks import handle_trigger_action
from sentry.incidents.utils.metric_issue_poc import create_or_update_metric_issue
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.models.project import Project
from sentry.search.eap.utils import add_start_end_conditions
from sentry.seer.anomaly_detection.get_anomaly_data import get_anomaly_data_from_seer
from sentry.seer.anomaly_detection.utils import anomaly_has_confidence, has_anomaly
from sentry.snuba.dataset import Dataset
from sentry.snuba.entity_subscription import (
    ENTITY_TIME_COLUMNS,
    get_entity_key_from_query_builder,
    get_entity_subscription_from_snuba_query,
)
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.snuba.subscriptions import delete_snuba_subscription
from sentry.utils import metrics, redis, snuba_rpc
from sentry.utils.dates import to_datetime

logger = logging.getLogger(__name__)
REDIS_TTL = int(timedelta(days=7).total_seconds())
ALERT_RULE_BASE_KEY = "{alert_rule:%s:project:%s}"
ALERT_RULE_BASE_STAT_KEY = "%s:%s"
ALERT_RULE_STAT_KEYS = ("last_update",)
ALERT_RULE_BASE_TRIGGER_STAT_KEY = "%s:trigger:%s:%s"
ALERT_RULE_TRIGGER_STAT_KEYS = ("alert_triggered", "resolve_triggered")
# Stores a minimum threshold that represents a session count under which we don't evaluate crash
# rate alert, and the update is just dropped. If it is set to None, then no minimum threshold
# check is applied
# ToDo(ahmed): This is still experimental. If we decide that it makes sense to keep this
#  functionality, then maybe we should move this to constants
CRASH_RATE_ALERT_MINIMUM_THRESHOLD: int | None = None

T = TypeVar("T")


class SubscriptionProcessor:
    """
    Class for processing subscription updates for an alert rule. Accepts a subscription
    and then can process one or more updates via `process_update`. Keeps track of how
    close an alert rule is to alerting, creates an incident, and auto resolves the
    incident if a resolve threshold is set and the threshold is triggered.

    TODO:
    IF processing a subscription update with NO QuerySubscription - delete the query _in_ snuba
    IF processing a subscription for a QuerySubscription with NO AlertRule - delete the query _in_ snuba _and_ the QuerySubscription
    """

    # Each entry is a tuple in format (<alert_operator>, <resolve_operator>)
    THRESHOLD_TYPE_OPERATORS = {
        AlertRuleThresholdType.ABOVE: (operator.gt, operator.lt),
        AlertRuleThresholdType.BELOW: (operator.lt, operator.gt),
    }

    def __init__(self, subscription: QuerySubscription) -> None:
        self.subscription = subscription
        try:
            self.alert_rule = AlertRule.objects.get_for_subscription(subscription)
        except AlertRule.DoesNotExist:
            return

        self.triggers = AlertRuleTrigger.objects.get_for_alert_rule(self.alert_rule)
        self.triggers.sort(key=lambda trigger: trigger.alert_threshold)

        (
            self.last_update,
            self.trigger_alert_counts,
            self.trigger_resolve_counts,
        ) = get_alert_rule_stats(self.alert_rule, self.subscription, self.triggers)
        self.orig_trigger_alert_counts = deepcopy(self.trigger_alert_counts)
        self.orig_trigger_resolve_counts = deepcopy(self.trigger_resolve_counts)

    @property
    def active_incident(self) -> Incident:
        """
        fetches an incident given the alert rule, project (and subscription if available)
        """
        if not hasattr(self, "_active_incident"):
            incident = Incident.objects.get_active_incident(
                alert_rule=self.alert_rule,
                project=self.subscription.project,
                subscription=self.subscription,
            )
            if not incident:
                # TODO: make subscription required
                incident = Incident.objects.get_active_incident(
                    alert_rule=self.alert_rule, project=self.subscription.project
                )
            self._active_incident = incident
        return self._active_incident

    @active_incident.setter
    def active_incident(self, active_incident: Incident) -> None:
        self._active_incident = active_incident

    @property
    def incident_trigger_map(self) -> dict[int, IncidentTrigger]:
        """
        mapping of alert rule trigger id to incident trigger
        NOTE: IncidentTrigger is keyed via ("incident", "alert_rule_trigger")
        """
        if not hasattr(self, "_incident_triggers"):
            incident = self.active_incident
            incident_triggers = {}
            if incident:
                # Fetch any existing triggers for the rule
                triggers = IncidentTrigger.objects.filter(incident=incident).select_related(
                    "alert_rule_trigger"
                )
                incident_triggers = {trigger.alert_rule_trigger_id: trigger for trigger in triggers}
            self._incident_triggers = incident_triggers
        return self._incident_triggers

    def check_trigger_matches_status(
        self, trigger: AlertRuleTrigger, status: TriggerStatus
    ) -> bool:
        """
        Determines whether a trigger is currently at the specified status
        :param trigger: An `AlertRuleTrigger`
        :param status: A `TriggerStatus`
        :return: True if at the specified status, otherwise False
        """
        incident_trigger = self.incident_trigger_map.get(trigger.id)
        return incident_trigger is not None and incident_trigger.status == status.value

    def reset_trigger_counts(self) -> None:
        """
        Helper method that clears both the trigger alert and the trigger resolve counts
        """
        for trigger_id in self.trigger_alert_counts:
            self.trigger_alert_counts[trigger_id] = 0
        for trigger_id in self.trigger_resolve_counts:
            self.trigger_resolve_counts[trigger_id] = 0
        self.update_alert_rule_stats()

    def calculate_resolve_threshold(self, trigger: IncidentTrigger) -> float:
        """
        Determine the resolve threshold for a trigger. First checks whether an
        explicit resolve threshold has been set on the rule, and whether this trigger is
        the lowest severity on the rule. If not, calculates a threshold based on the
        `alert_threshold` on the trigger.
        :return:
        """
        if self.alert_rule.resolve_threshold is not None and (
            # If we have one trigger, then it's the lowest severity. Otherwise, check if
            # it's the warning trigger
            len(self.triggers) == 1
            or trigger.label == WARNING_TRIGGER_LABEL
        ):
            resolve_threshold: float = self.alert_rule.resolve_threshold
            return resolve_threshold

        # Since we only support gt/lt thresholds we have an off-by-one with auto
        # resolve. If we have an alert threshold of > 0, and no resolve threshold, then
        # we'd automatically set this to < 0, which can never happen. To work around
        # this, we add a small amount to the number so that in this case we'd have
        # the resolve threshold be < 0.000001. This means that when we hit 0 we'll still
        # resolve as expected.
        # TODO: We should probably support gte/lte at some point so that we can avoid
        # these hacks.
        if self.alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value:
            resolve_add = 0.000001
        else:
            resolve_add = -0.000001

        threshold: float = trigger.alert_threshold + resolve_add
        return threshold

    def get_comparison_aggregation_value(
        self, subscription_update: QuerySubscriptionUpdate, aggregation_value: float
    ) -> float | None:
        # For comparison alerts run a query over the comparison period and use it to calculate the
        # % change.
        delta = timedelta(seconds=self.alert_rule.comparison_delta)
        end = subscription_update["timestamp"] - delta
        snuba_query = self.subscription.snuba_query
        start = end - timedelta(seconds=snuba_query.time_window)

        entity_subscription = get_entity_subscription_from_snuba_query(
            snuba_query,
            self.subscription.project.organization_id,
        )
        dataset = Dataset(snuba_query.dataset)
        query_type = SnubaQuery.Type(snuba_query.type)
        project_ids = [self.subscription.project_id]

        comparison_aggregate: None | float = None
        if query_type == SnubaQuery.Type.PERFORMANCE and dataset == Dataset.EventsAnalyticsPlatform:
            try:
                rpc_time_series_request = entity_subscription.build_rpc_request(
                    query=snuba_query.query,
                    project_ids=project_ids,
                    environment=snuba_query.environment,
                    params={
                        "organization_id": self.subscription.project.organization.id,
                        "project_id": project_ids,
                    },
                    referrer="subscription_processor.comparison_query",
                )

                rpc_time_series_request = add_start_end_conditions(
                    rpc_time_series_request, start, end
                )

                rpc_response = snuba_rpc.timeseries_rpc(rpc_time_series_request)
                if len(rpc_response.result_timeseries):
                    comparison_aggregate = rpc_response.result_timeseries[0].data_points[0].data

            except Exception:
                logger.exception(
                    "Failed to run RPC comparison query",
                    extra={
                        "alert_rule_id": self.alert_rule.id,
                        "subscription_id": subscription_update.get("subscription_id"),
                        "organization_id": self.alert_rule.organization_id,
                    },
                )
                return None

        else:
            try:
                # TODO: determine whether we need to include the subscription query_extra here
                query_builder = entity_subscription.build_query_builder(
                    query=snuba_query.query,
                    project_ids=project_ids,
                    environment=snuba_query.environment,
                    params={
                        "organization_id": self.subscription.project.organization.id,
                        "project_id": project_ids,
                        "start": start,
                        "end": end,
                    },
                )
                time_col = ENTITY_TIME_COLUMNS[get_entity_key_from_query_builder(query_builder)]
                query_builder.add_conditions(
                    [
                        Condition(Column(time_col), Op.GTE, start),
                        Condition(Column(time_col), Op.LT, end),
                    ]
                )
                query_builder.limit = Limit(1)
                results = query_builder.run_query(
                    referrer="subscription_processor.comparison_query"
                )
                comparison_aggregate = list(results["data"][0].values())[0]

            except Exception:
                logger.exception(
                    "Failed to run comparison query",
                    extra={
                        "alert_rule_id": self.alert_rule.id,
                        "subscription_id": subscription_update.get("subscription_id"),
                        "organization_id": self.alert_rule.organization_id,
                    },
                )
                return None

        if not comparison_aggregate:
            metrics.incr("incidents.alert_rules.skipping_update_comparison_value_invalid")
            return None

        result: float = (aggregation_value / comparison_aggregate) * 100
        return result

    def get_crash_rate_alert_metrics_aggregation_value(
        self, subscription_update: QuerySubscriptionUpdate
    ) -> float | None:
        """
        Handles validation and extraction of Crash Rate Alerts subscription updates values over
        metrics dataset.
        The subscription update looks like
        [
            {'project_id': 8, 'tags[5]': 6, 'count': 2.0, 'crashed': 1.0}
        ]
        - `count` represents sessions or users sessions that were started, hence to get the crash
        free percentage, we would need to divide number of crashed sessions by that number,
        and subtract that value from 1. This is also used when CRASH_RATE_ALERT_MINIMUM_THRESHOLD is
        set in the sense that if the minimum threshold is greater than the session count,
        then the update is dropped. If the minimum threshold is not set then the total sessions
        count is just ignored
        - `crashed` represents the total sessions or user counts that crashed.
        """
        row = subscription_update["values"]["data"][0]
        total_session_count = row.get("count", 0)
        crash_count = row.get("crashed", 0)

        if total_session_count == 0:
            self.reset_trigger_counts()
            metrics.incr("incidents.alert_rules.ignore_update_no_session_data")
            return None

        if CRASH_RATE_ALERT_MINIMUM_THRESHOLD is not None:
            min_threshold = int(CRASH_RATE_ALERT_MINIMUM_THRESHOLD)
            if total_session_count < min_threshold:
                self.reset_trigger_counts()
                metrics.incr("incidents.alert_rules.ignore_update_count_lower_than_min_threshold")
                return None

        aggregation_value: int = round((1 - crash_count / total_session_count) * 100, 3)

        return aggregation_value

    def get_aggregation_value(self, subscription_update: QuerySubscriptionUpdate) -> float | None:
        if self.subscription.snuba_query.dataset == Dataset.Metrics.value:
            aggregation_value = self.get_crash_rate_alert_metrics_aggregation_value(
                subscription_update
            )
        else:
            aggregation_value = list(subscription_update["values"]["data"][0].values())[0]
            # In some cases Snuba can return a None value for an aggregation. This means
            # there were no rows present when we made the query for certain types of aggregations
            # like avg. Defaulting this to 0 for now. It might turn out that we'd prefer to skip
            # the update in the future.
            if aggregation_value is None:
                aggregation_value = 0

            if self.alert_rule.comparison_delta:
                aggregation_value = self.get_comparison_aggregation_value(
                    subscription_update, aggregation_value
                )

        return aggregation_value

    def process_update(self, subscription_update: QuerySubscriptionUpdate) -> None:
        """
        This is the core processing method utilized when Query Subscription Consumer fetches updates from kafka
        """
        dataset = self.subscription.snuba_query.dataset
        try:
            # Check that the project exists
            self.subscription.project
        except Project.DoesNotExist:
            metrics.incr("incidents.alert_rules.ignore_deleted_project")
            return
        if dataset == "events" and not features.has(
            "organizations:incidents", self.subscription.project.organization
        ):
            # They have downgraded since these subscriptions have been created. So we just ignore updates for now.
            metrics.incr("incidents.alert_rules.ignore_update_missing_incidents")
            return
        elif dataset == "transactions" and not features.has(
            "organizations:performance-view", self.subscription.project.organization
        ):
            # They have downgraded since these subscriptions have been created. So we just ignore updates for now.
            metrics.incr("incidents.alert_rules.ignore_update_missing_incidents_performance")
            return

        if not hasattr(self, "alert_rule"):
            # QuerySubscriptions must _always_ have an associated AlertRule
            # If the alert rule has been removed then clean up associated tables and return
            metrics.incr("incidents.alert_rules.no_alert_rule_for_subscription")
            delete_snuba_subscription(self.subscription)
            return

        if subscription_update["timestamp"] <= self.last_update:
            metrics.incr("incidents.alert_rules.skipping_already_processed_update")
            return

        self.last_update = subscription_update["timestamp"]

        if (
            len(subscription_update["values"]["data"]) > 1
            and self.subscription.snuba_query.dataset != Dataset.Metrics.value
        ):
            logger.warning(
                "Subscription returned more than 1 row of data",
                extra={
                    "subscription_id": self.subscription.id,
                    "dataset": self.subscription.snuba_query.dataset,
                    "snuba_subscription_id": self.subscription.subscription_id,
                    "result": subscription_update,
                },
            )

        aggregation_value = self.get_aggregation_value(subscription_update)
        if features.has(
            "organizations:failure-rate-metric-alert-logging",
            self.subscription.project.organization,
        ):
            logger.info(
                "Update value in subscription processor",
                extra={
                    "result": subscription_update,
                    "aggregation_value": aggregation_value,
                    "rule_id": self.alert_rule.id,
                },
            )

        has_anomaly_detection = features.has(
            "organizations:anomaly-detection-alerts", self.subscription.project.organization
        ) and features.has(
            "organizations:anomaly-detection-rollout", self.subscription.project.organization
        )

        potential_anomalies = None
        if (
            has_anomaly_detection
            and self.alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC
        ):
            with metrics.timer(
                "incidents.subscription_processor.process_update.get_anomaly_data_from_seer"
            ):
                potential_anomalies = get_anomaly_data_from_seer(
                    alert_rule=self.alert_rule,
                    subscription=self.subscription,
                    last_update=self.last_update.timestamp(),
                    aggregation_value=aggregation_value,
                )
            if potential_anomalies is None:
                logger.info(
                    "No potential anomalies found",
                    extra={
                        "subscription_id": self.subscription.id,
                        "dataset": self.alert_rule.snuba_query.dataset,
                        "organization_id": self.subscription.project.organization.id,
                        "project_id": self.subscription.project_id,
                        "alert_rule_id": self.alert_rule.id,
                    },
                )
                return

        # Trigger callbacks for any AlertRules that may need to know about the subscription update
        # Current callback will update the activation metric values & delete querysubscription on finish
        # TODO: register over/under triggers as alert rule callbacks as well
        invoke_alert_subscription_callback(
            AlertRuleMonitorTypeInt(self.alert_rule.monitor_type),
            subscription=self.subscription,
            alert_rule=self.alert_rule,
            value=aggregation_value,
        )

        if aggregation_value is None:
            metrics.incr("incidents.alert_rules.skipping_update_invalid_aggregation_value")
            return

        # OVER/UNDER value trigger
        alert_operator = None
        resolve_operator = None
        if not potential_anomalies:
            alert_operator, resolve_operator = self.THRESHOLD_TYPE_OPERATORS[
                AlertRuleThresholdType(self.alert_rule.threshold_type)
            ]
        fired_incident_triggers = []
        with transaction.atomic(router.db_for_write(AlertRule)):
            # Triggers is the threshold - NOT an instance of a trigger
            for trigger in self.triggers:
                if potential_anomalies:
                    # NOTE: There should only be one anomaly in the list
                    for potential_anomaly in potential_anomalies:
                        # check to see if we have enough data for the dynamic alert rule now
                        if self.alert_rule.status == AlertRuleStatus.NOT_ENOUGH_DATA.value:
                            if anomaly_has_confidence(potential_anomaly):
                                # NOTE: this means "enabled," and it's the default alert rule status.
                                # TODO: change these status labels to be less confusing
                                self.alert_rule.status = AlertRuleStatus.PENDING.value
                                self.alert_rule.save()
                            else:
                                # we don't need to check if the alert should fire if the alert can't fire yet
                                continue

                        if has_anomaly(
                            potential_anomaly, trigger.label
                        ) and not self.check_trigger_matches_status(trigger, TriggerStatus.ACTIVE):
                            metrics.incr(
                                "incidents.alert_rules.threshold.alert",
                                tags={"detection_type": self.alert_rule.detection_type},
                            )
                            incident_trigger = self.trigger_alert_threshold(
                                trigger, aggregation_value
                            )
                            if incident_trigger is not None:
                                fired_incident_triggers.append(incident_trigger)
                        else:
                            self.trigger_alert_counts[trigger.id] = 0

                        if (
                            not has_anomaly(potential_anomaly, trigger.label)
                            and self.active_incident
                            and self.check_trigger_matches_status(trigger, TriggerStatus.ACTIVE)
                        ):
                            metrics.incr(
                                "incidents.alert_rules.threshold.resolve",
                                tags={"detection_type": self.alert_rule.detection_type},
                            )
                            incident_trigger = self.trigger_resolve_threshold(
                                trigger, aggregation_value
                            )

                            if incident_trigger is not None:
                                fired_incident_triggers.append(incident_trigger)
                        else:
                            self.trigger_resolve_counts[trigger.id] = 0
                else:
                    if alert_operator(
                        aggregation_value, trigger.alert_threshold
                    ) and not self.check_trigger_matches_status(trigger, TriggerStatus.ACTIVE):
                        # If the value has breached our threshold (above/below)
                        # And the trigger is not yet active
                        metrics.incr(
                            "incidents.alert_rules.threshold.alert",
                            tags={"detection_type": self.alert_rule.detection_type},
                        )
                        # triggering a threshold will create an incident and set the status to active
                        incident_trigger = self.trigger_alert_threshold(trigger, aggregation_value)
                        if incident_trigger is not None:
                            fired_incident_triggers.append(incident_trigger)
                    else:
                        self.trigger_alert_counts[trigger.id] = 0

                    if (
                        resolve_operator(
                            aggregation_value, self.calculate_resolve_threshold(trigger)
                        )
                        and self.active_incident
                        and self.check_trigger_matches_status(trigger, TriggerStatus.ACTIVE)
                    ):
                        metrics.incr(
                            "incidents.alert_rules.threshold.resolve",
                            tags={"detection_type": self.alert_rule.detection_type},
                        )
                        incident_trigger = self.trigger_resolve_threshold(
                            trigger, aggregation_value
                        )

                        if incident_trigger is not None:
                            fired_incident_triggers.append(incident_trigger)
                    else:
                        self.trigger_resolve_counts[trigger.id] = 0

            if fired_incident_triggers:
                # For all the newly created incidents
                # handle the associated actions (eg. send an email/notification)
                self.handle_trigger_actions(
                    incident_triggers=fired_incident_triggers, metric_value=aggregation_value
                )

        # We update the rule stats here after we commit the transaction. This guarantees
        # that we'll never miss an update, since we'll never roll back if the process
        # is killed here. The trade-off is that we might process an update twice. Mostly
        # this will have no effect, but if someone manages to close a triggered incident
        # before the next one then we might alert twice.
        self.update_alert_rule_stats()

    def calculate_event_date_from_update_date(self, update_date: datetime) -> datetime:
        """
        Calculates the date that an event actually happened based on the date that we
        received the update. This takes into account time window and threshold period.
        :return:
        """
        # Subscriptions label buckets by the end of the bucket, whereas discover
        # labels them by the front. This causes us an off-by-one error with event dates,
        # so to prevent this we subtract a bucket off of the date.
        update_date -= timedelta(seconds=self.alert_rule.snuba_query.time_window)
        # We want to also subtract `frequency * (threshold_period - 1)` from the date.
        # This allows us to show the actual start of the event, rather than the date
        # of the last update that we received.
        return update_date - timedelta(
            seconds=(
                self.alert_rule.snuba_query.resolution * (self.alert_rule.threshold_period - 1)
            )
        )

    def trigger_alert_threshold(
        self, trigger: AlertRuleTrigger, metric_value: float
    ) -> IncidentTrigger | None:
        """
        Called when a subscription update exceeds the value defined in the
        `trigger.alert_threshold`, and the trigger hasn't already been activated.
        Increments the count of how many times we've consecutively exceeded the threshold, and if
        above the `threshold_period` defined in the alert rule then mark the trigger as
        activated, and create an incident if there isn't already one.
        :return:
        """
        self.trigger_alert_counts[trigger.id] += 1

        # If an incident was created for this rule, trigger type, and subscription
        # within the last 10 minutes, don't make another one
        last_it = (
            IncidentTrigger.objects.filter(alert_rule_trigger=trigger)
            .order_by("-incident_id")
            .select_related("incident")
            .first()
        )
        last_incident: Incident | None = last_it.incident if last_it else None
        last_incident_projects = (
            [project.id for project in last_incident.projects.all()] if last_incident else []
        )
        minutes_since_last_incident = (
            (timezone.now() - last_incident.date_added).seconds / 60 if last_incident else None
        )
        if (
            last_incident
            and self.subscription.project.id in last_incident_projects
            and minutes_since_last_incident <= 10
        ):
            metrics.incr(
                "incidents.alert_rules.hit_rate_limit",
                tags={
                    "last_incident_id": last_incident.id,
                    "project_id": self.subscription.project.id,
                    "trigger_id": trigger.id,
                },
            )
            return None
        # 'threshold_period' - how many times an alert value must exceed the threshold to fire/resolve the alert
        if self.trigger_alert_counts[trigger.id] >= self.alert_rule.threshold_period:
            metrics.incr("incidents.alert_rules.trigger", tags={"type": "fire"})

            # Only create a new incident if we don't already have an active incident for the AlertRule
            if not self.active_incident:
                detected_at = self.calculate_event_date_from_update_date(self.last_update)
                activation: AlertRuleActivations | None = None
                if self.alert_rule.monitor_type == AlertRuleMonitorTypeInt.ACTIVATED:
                    activations = list(self.subscription.alertruleactivations_set.all())
                    if len(activations) != 1:
                        logger.error(
                            "activated alert rule subscription has unexpected activation instances",
                            extra={
                                "activations_count": len(activations),
                            },
                        )
                    else:
                        activation = activations[0]

                self.active_incident = create_incident(
                    organization=self.alert_rule.organization,
                    incident_type=IncidentType.ALERT_TRIGGERED,
                    # TODO: Include more info in name?
                    title=self.alert_rule.name,
                    alert_rule=self.alert_rule,
                    date_started=detected_at,
                    date_detected=self.last_update,
                    projects=[self.subscription.project],
                    activation=activation,
                    subscription=self.subscription,
                )
            # Now create (or update if it already exists) the incident trigger so that
            # we have a record of this trigger firing for this incident
            # NOTE: `incident_triggers` is derived from `self.active_incident`
            incident_trigger = self.incident_trigger_map.get(trigger.id)
            if incident_trigger:
                incident_trigger.status = TriggerStatus.ACTIVE.value
                incident_trigger.save()
            else:
                incident_trigger = IncidentTrigger.objects.create(
                    incident=self.active_incident,
                    alert_rule_trigger=trigger,
                    status=TriggerStatus.ACTIVE.value,
                )
            self.handle_incident_severity_update()
            self.incident_trigger_map[trigger.id] = incident_trigger

            # TODO: We should create an audit log, and maybe something that keeps
            # all of the details available for showing on the incident. Might be a json
            # blob or w/e? Or might be able to use the audit log

            # We now set this threshold to 0. We don't need to count it anymore
            # once we've triggered an incident.
            self.trigger_alert_counts[trigger.id] = 0
            return incident_trigger
        else:
            return None

    def check_triggers_resolved(self) -> bool:
        """
        Determines whether all triggers associated with the active incident are
        resolved. A trigger is considered resolved if it is in the
        `TriggerStatus.Resolved` state.
        :return:
        """
        for incident_trigger in self.incident_trigger_map.values():
            if incident_trigger.status != TriggerStatus.RESOLVED.value:
                return False
        return True

    def trigger_resolve_threshold(
        self, trigger: AlertRuleTrigger, metric_value: float
    ) -> IncidentTrigger | None:
        """
        Called when a subscription update exceeds the trigger resolve threshold and the
        trigger is currently ACTIVE.
        :return:
        """
        self.trigger_resolve_counts[trigger.id] += 1
        if self.trigger_resolve_counts[trigger.id] >= self.alert_rule.threshold_period:
            metrics.incr("incidents.alert_rules.trigger", tags={"type": "resolve"})
            incident_trigger = self.incident_trigger_map[trigger.id]
            incident_trigger.status = TriggerStatus.RESOLVED.value
            incident_trigger.save()
            self.trigger_resolve_counts[trigger.id] = 0

            if self.check_triggers_resolved():
                update_incident_status(
                    self.active_incident,
                    IncidentStatus.CLOSED,
                    status_method=IncidentStatusMethod.RULE_TRIGGERED,
                    date_closed=self.calculate_event_date_from_update_date(self.last_update),
                )
                self.active_incident = None
                self.incident_trigger_map.clear()
            else:
                self.handle_incident_severity_update()

            return incident_trigger
        else:
            return None

    def handle_trigger_actions(
        self, incident_triggers: list[IncidentTrigger], metric_value: float
    ) -> None:
        # Actions represent the notification type that should be triggered when an alert is fired
        actions = deduplicate_trigger_actions(triggers=deepcopy(self.triggers))
        # Grab the first trigger to get incident id (they are all the same)
        # All triggers should either be firing or resolving, so doesn't matter which we grab.
        incident_trigger = incident_triggers[0]
        method = (
            AlertRuleTriggerActionMethod.FIRE.value
            if incident_trigger.status == TriggerStatus.ACTIVE.value
            else AlertRuleTriggerActionMethod.RESOLVE.value
        )

        # NOTE: all incident_triggers are derived from self.active_incident, so if active_incident is
        # still set we can save ourselves a query
        incident = self.active_incident
        if not incident:
            # NOTE: trigger_resolve_threshold clears the active incident cache
            # So fetch the incident if active_incident has already been removed
            incident = Incident.objects.get(id=incident_trigger.incident_id)

        incident_activities = IncidentActivity.objects.filter(incident=incident).values_list(
            "value", flat=True
        )
        past_statuses = {
            int(value) for value in incident_activities.distinct() if value is not None
        }

        critical_actions = []
        warning_actions = []
        for action in actions:
            if action.alert_rule_trigger.label == CRITICAL_TRIGGER_LABEL:
                critical_actions.append(action)
            else:
                warning_actions.append(action)

        actions_to_fire = []
        new_status = IncidentStatus.CLOSED.value

        if method == AlertRuleTriggerActionMethod.RESOLVE.value:
            if incident.status != IncidentStatus.CLOSED.value:
                # Critical -> warning
                actions_to_fire = actions
                new_status = IncidentStatus.WARNING.value
            elif IncidentStatus.CRITICAL.value in past_statuses:
                # Critical -> resolved or warning -> resolved, but was critical previously
                actions_to_fire = actions
                new_status = IncidentStatus.CLOSED.value
            else:
                # Warning -> resolved
                actions_to_fire = warning_actions
                new_status = IncidentStatus.CLOSED.value
        else:
            # method == "fire"
            if incident.status == IncidentStatus.CRITICAL.value:
                # Anything -> critical
                actions_to_fire = actions
                new_status = IncidentStatus.CRITICAL.value
            else:
                # Resolved -> warning:
                actions_to_fire = warning_actions
                new_status = IncidentStatus.WARNING.value

        # Schedule the actions to be fired
        for action in actions_to_fire:
            transaction.on_commit(
                handle_trigger_action.s(
                    action_id=action.id,
                    incident_id=incident.id,
                    project_id=self.subscription.project_id,
                    method=method,
                    new_status=new_status,
                    metric_value=metric_value,
                ).delay,
                router.db_for_write(AlertRule),
            )

        if features.has("organizations:metric-issue-poc", self.alert_rule.organization):
            create_or_update_metric_issue(
                incident=incident,
                metric_value=metric_value,
            )

    def handle_incident_severity_update(self) -> None:
        if self.active_incident:
            active_incident_triggers = IncidentTrigger.objects.filter(
                incident=self.active_incident, status=TriggerStatus.ACTIVE.value
            )
            severity = None
            for active_incident_trigger in active_incident_triggers:
                trigger = active_incident_trigger.alert_rule_trigger
                if trigger.label == CRITICAL_TRIGGER_LABEL:
                    severity = IncidentStatus.CRITICAL
                    break
                elif trigger.label == WARNING_TRIGGER_LABEL:
                    severity = IncidentStatus.WARNING

            if severity:
                update_incident_status(
                    self.active_incident,
                    severity,
                    status_method=IncidentStatusMethod.RULE_TRIGGERED,
                )

    def update_alert_rule_stats(self) -> None:
        """
        Updates stats about the alert rule, if they're changed.
        :return:
        """
        updated_trigger_alert_counts = {
            trigger_id: alert_count
            for trigger_id, alert_count in self.trigger_alert_counts.items()
            if alert_count != self.orig_trigger_alert_counts[trigger_id]
        }
        updated_trigger_resolve_counts = {
            trigger_id: alert_count
            for trigger_id, alert_count in self.trigger_resolve_counts.items()
            if alert_count != self.orig_trigger_resolve_counts[trigger_id]
        }

        update_alert_rule_stats(
            self.alert_rule,
            self.subscription,
            self.last_update,
            updated_trigger_alert_counts,
            updated_trigger_resolve_counts,
        )


def build_alert_rule_stat_keys(alert_rule: AlertRule, subscription: QuerySubscription) -> list[str]:
    """
    Builds keys for fetching stats about alert rules
    :return: A list containing the alert rule stat keys
    """
    key_base = ALERT_RULE_BASE_KEY % (alert_rule.id, subscription.project_id)
    return [ALERT_RULE_BASE_STAT_KEY % (key_base, stat_key) for stat_key in ALERT_RULE_STAT_KEYS]


def build_trigger_stat_keys(
    alert_rule: AlertRule, subscription: QuerySubscription, triggers: list[AlertRuleTrigger]
) -> list[str]:
    """
    Builds keys for fetching stats about triggers
    :return: A list containing the alert rule trigger stat keys
    """
    return [
        build_alert_rule_trigger_stat_key(
            alert_rule.id, subscription.project_id, trigger.id, stat_key
        )
        for trigger in triggers
        for stat_key in ALERT_RULE_TRIGGER_STAT_KEYS
    ]


def build_alert_rule_trigger_stat_key(
    alert_rule_id: int, project_id: int, trigger_id: int, stat_key: str
) -> str:
    key_base = ALERT_RULE_BASE_KEY % (alert_rule_id, project_id)
    return ALERT_RULE_BASE_TRIGGER_STAT_KEY % (key_base, trigger_id, stat_key)


def partition(iterable: Sequence[T], n: int) -> Sequence[Sequence[T]]:
    """
    Partitions an iterable into tuples of size n. Expects the iterable length to be a
    multiple of n.
    partition('ABCDEF', 3) --> [('A', 'B', 'C'), ('D', 'E', 'F')]
    """
    assert len(iterable) % n == 0
    args = [iter(iterable)] * n
    return cast(Sequence[Sequence[T]], zip(*args))


def get_alert_rule_stats(
    alert_rule: AlertRule, subscription: QuerySubscription, triggers: list[AlertRuleTrigger]
) -> tuple[datetime, dict[str, int], dict[str, int]]:
    """
    Fetches stats about the alert rule, specific to the current subscription
    :return: A tuple containing the stats about the alert rule and subscription.
     - last_update: Int representing the timestamp it was last updated
     - trigger_alert_counts: A dict of trigger alert counts, where the key is the
       trigger id, and the value is an int representing how many consecutive times we
       have triggered the alert threshold
     - trigger_resolve_counts: A dict of trigger resolve counts, where the key is the
       trigger id, and the value is an int representing how many consecutive times we
       have triggered the resolve threshold
    """
    alert_rule_keys = build_alert_rule_stat_keys(alert_rule, subscription)
    trigger_keys = build_trigger_stat_keys(alert_rule, subscription, triggers)
    results = get_redis_client().mget(alert_rule_keys + trigger_keys)
    results = tuple(0 if result is None else int(result) for result in results)
    last_update = to_datetime(results[0])
    trigger_results = results[1:]
    trigger_alert_counts = {}
    trigger_resolve_counts = {}

    for trigger, trigger_result in zip(
        triggers, partition(trigger_results, len(ALERT_RULE_TRIGGER_STAT_KEYS))
    ):
        trigger_alert_counts[trigger.id] = trigger_result[0]
        trigger_resolve_counts[trigger.id] = trigger_result[1]

    return last_update, trigger_alert_counts, trigger_resolve_counts


def update_alert_rule_stats(
    alert_rule: AlertRule,
    subscription: QuerySubscription,
    last_update: datetime,
    alert_counts: dict[int, int],
    resolve_counts: dict[int, int],
) -> None:
    """
    Updates stats about the alert rule, subscription and triggers if they've changed.
    """
    pipeline = get_redis_client().pipeline()

    counts_with_stat_keys = zip(ALERT_RULE_TRIGGER_STAT_KEYS, (alert_counts, resolve_counts))
    for stat_key, trigger_counts in counts_with_stat_keys:
        for trigger_id, alert_count in trigger_counts.items():
            pipeline.set(
                build_alert_rule_trigger_stat_key(
                    alert_rule.id, subscription.project_id, trigger_id, stat_key
                ),
                alert_count,
                ex=REDIS_TTL,
            )

    last_update_key = build_alert_rule_stat_keys(alert_rule, subscription)[0]
    pipeline.set(last_update_key, int(last_update.timestamp()), ex=REDIS_TTL)
    pipeline.execute()


def get_redis_client() -> RetryingRedisCluster:
    cluster_key = settings.SENTRY_INCIDENT_RULES_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]
