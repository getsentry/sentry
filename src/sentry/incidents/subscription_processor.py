from __future__ import absolute_import

import logging
import operator
from copy import deepcopy
from datetime import timedelta


from django.conf import settings
from django.db import transaction

from sentry import features
from sentry.incidents.logic import create_incident, update_incident_status
from sentry.incidents.endpoints.serializers import WARNING_TRIGGER_LABEL, CRITICAL_TRIGGER_LABEL
from sentry.incidents.models import (
    AlertRule,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    Incident,
    IncidentStatus,
    IncidentStatusMethod,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.incidents.tasks import handle_trigger_action
from sentry.utils import metrics, redis
from sentry.utils.dates import to_datetime, to_timestamp
from sentry.utils.compat import zip


logger = logging.getLogger(__name__)
REDIS_TTL = int(timedelta(days=7).total_seconds())
ALERT_RULE_BASE_KEY = "{alert_rule:%s:project:%s}"
ALERT_RULE_BASE_STAT_KEY = "%s:%s"
ALERT_RULE_STAT_KEYS = ("last_update", "resolve_triggered")
ALERT_RULE_BASE_TRIGGER_STAT_KEY = "%s:trigger:%s:%s"
ALERT_RULE_TRIGGER_STAT_KEYS = ("alert_triggered",)


class SubscriptionProcessor(object):
    """
    Class for processing subscription updates for an alert rule. Accepts a subscription
    and then can process one or more updates via `process_update`. Keeps track of how
    close an alert rule is to alerting, creates an incident, and auto resolves the
    incident if a resolve threshold is set and the threshold is triggered.
    """

    # Each entry is a tuple in format (<alert_operator>, <resolve_operator>)
    THRESHOLD_TYPE_OPERATORS = {
        AlertRuleThresholdType.ABOVE: (operator.gt, operator.lt),
        AlertRuleThresholdType.BELOW: (operator.lt, operator.gt),
    }

    def __init__(self, subscription):
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
            self.rule_resolve_counts,
        ) = get_alert_rule_stats(self.alert_rule, self.subscription, self.triggers)
        self.orig_trigger_alert_counts = deepcopy(self.trigger_alert_counts)
        self.orig_rule_resolve_counts = self.rule_resolve_counts

    @property
    def active_incident(self):
        if not hasattr(self, "_active_incident"):
            self._active_incident = Incident.objects.get_active_incident(
                self.alert_rule, self.subscription.project
            )
        return self._active_incident

    @active_incident.setter
    def active_incident(self, active_incident):
        self._active_incident = active_incident

    @property
    def incident_triggers(self):
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

    def check_trigger_status(self, trigger, status):
        """
        Determines whether a trigger is currently at the specified status
        :param trigger: An `AlertRuleTrigger`
        :param status: A `TriggerStatus`
        :return: True if at the specified status, otherwise False
        """
        incident_trigger = self.incident_triggers.get(trigger.id)
        return incident_trigger is not None and incident_trigger.status == status.value

    def calculate_resolve_threshold(self):
        """
        Determine the resolve threshold for an alert rule. First checks whether an
        explicit resolve threshold has been set on the rule. If not, calculates a
        threshold based on the `alert_threshold` on the triggers associated with the
        rule.
        :return:
        """
        if self.alert_rule.resolve_threshold is not None:
            return self.alert_rule.resolve_threshold

        # Since we only support gt/lt thresholds we have an off-by-one with auto
        # resolve. If we have an alert threshold of > 0, and no resolve threshold, then
        # we'd automatically set this to < 0, which can never happen. To work around
        # this, we add a small amount to the number so that in this case we'd have
        # the resolve threshold be < 0.000001. This means that when we hit 0 we'll still
        # resolve as expected.
        # TODO: We should probably support gte/lte at some point so that we can avoid
        # these hacks.
        if self.alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value:
            func = min
            resolve_add = 0.000001
        else:
            func = max
            resolve_add = -0.000001

        return func(trigger.alert_threshold for trigger in self.triggers) + resolve_add

    def process_update(self, subscription_update):
        dataset = self.subscription.snuba_query.dataset
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
            # If the alert rule has been removed then just skip
            metrics.incr("incidents.alert_rules.no_alert_rule_for_subscription")
            logger.error(
                "Received an update for a subscription, but no associated alert rule exists"
            )
            # TODO: Delete subscription here.
            return

        if subscription_update["timestamp"] <= self.last_update:
            metrics.incr("incidents.alert_rules.skipping_already_processed_update")
            return

        self.last_update = subscription_update["timestamp"]

        if len(subscription_update["values"]["data"]) > 1:
            logger.warning(
                "Subscription returned more than 1 row of data",
                extra={
                    "subscription_id": self.subscription.id,
                    "dataset": self.subscription.snuba_query.dataset,
                    "snuba_subscription_id": self.subscription.subscription_id,
                    "result": subscription_update,
                },
            )
        aggregation_value = list(subscription_update["values"]["data"][0].values())[0]
        alert_operator, resolve_operator = self.THRESHOLD_TYPE_OPERATORS[
            AlertRuleThresholdType(self.alert_rule.threshold_type)
        ]
        for trigger in self.triggers:
            if alert_operator(
                aggregation_value, trigger.alert_threshold
            ) and not self.check_trigger_status(trigger, TriggerStatus.ACTIVE):
                metrics.incr("incidents.alert_rules.threshold", tags={"type": "alert"})
                with transaction.atomic():
                    self.trigger_alert_threshold(trigger, aggregation_value)
            else:
                self.trigger_alert_counts[trigger.id] = 0

        if (
            resolve_operator(aggregation_value, self.calculate_resolve_threshold())
            and self.active_incident
        ):
            self.rule_resolve_counts += 1
            if self.rule_resolve_counts >= self.alert_rule.threshold_period:
                # TODO: Make sure we iterate over critical then warning in order.
                # Potentially also de-dupe actions that are identical. Maybe just
                # collect all actions, de-dupe and resolve all at once
                metrics.incr("incidents.alert_rules.threshold", tags={"type": "resolve"})
                for trigger in self.triggers:
                    if self.check_trigger_status(trigger, TriggerStatus.ACTIVE):
                        with transaction.atomic():
                            self.trigger_resolve_threshold(trigger, aggregation_value)

                update_incident_status(
                    self.active_incident,
                    IncidentStatus.CLOSED,
                    status_method=IncidentStatusMethod.RULE_TRIGGERED,
                    date_closed=self.calculate_event_date_from_update_date(self.last_update),
                )
                self.active_incident = None
                self.incident_triggers.clear()
                self.rule_resolve_counts = 0
        else:
            self.rule_resolve_counts = 0

        # We update the rule stats here after we commit the transaction. This guarantees
        # that we'll never miss an update, since we'll never roll back if the process
        # is killed here. The trade-off is that we might process an update twice. Mostly
        # this will have no effect, but if someone manages to close a triggered incident
        # before the next one then we might alert twice.
        self.update_alert_rule_stats()

    def calculate_event_date_from_update_date(self, update_date):
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

    def trigger_alert_threshold(self, trigger, metric_value):
        """
        Called when a subscription update exceeds the value defined in the
        `trigger.alert_threshold`, and the trigger hasn't already been activated.
        Increments the count of how many times we've consecutively exceeded the threshold, and if
        above the `threshold_period` defined in the alert rule then mark the trigger as
        activated, and create an incident if there isn't already one.
        :return:
        """
        self.trigger_alert_counts[trigger.id] += 1
        if self.trigger_alert_counts[trigger.id] >= self.alert_rule.threshold_period:
            metrics.incr("incidents.alert_rules.trigger", tags={"type": "fire"})
            # Only create a new incident if we don't already have an active one
            if not self.active_incident:
                detected_at = self.calculate_event_date_from_update_date(self.last_update)
                self.active_incident = create_incident(
                    self.alert_rule.organization,
                    IncidentType.ALERT_TRIGGERED,
                    # TODO: Include more info in name?
                    self.alert_rule.name,
                    alert_rule=self.alert_rule,
                    date_started=detected_at,
                    date_detected=self.last_update,
                    projects=[self.subscription.project],
                )
            # Now create (or update if it already exists) the incident trigger so that
            # we have a record of this trigger firing for this incident
            incident_trigger = self.incident_triggers.get(trigger.id)
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
            self.handle_trigger_actions(incident_trigger, metric_value)
            self.incident_triggers[trigger.id] = incident_trigger

            # TODO: We should create an audit log, and maybe something that keeps
            # all of the details available for showing on the incident. Might be a json
            # blob or w/e? Or might be able to use the audit log

            # We now set this threshold to 0. We don't need to count it anymore
            # once we've triggered an incident.
            self.trigger_alert_counts[trigger.id] = 0

    def trigger_resolve_threshold(self, trigger, metric_value):
        """
        Called when a subscription update exceeds the value defined in
        `alert_rule.resolve_threshold` and the trigger is currently ACTIVE.
        :return:
        """
        metrics.incr("incidents.alert_rules.trigger", tags={"type": "resolve"})
        incident_trigger = self.incident_triggers[trigger.id]
        incident_trigger.status = TriggerStatus.RESOLVED.value
        incident_trigger.save()
        self.handle_trigger_actions(incident_trigger, metric_value)

    def handle_trigger_actions(self, incident_trigger, metric_value):
        method = "fire" if incident_trigger.status == TriggerStatus.ACTIVE.value else "resolve"

        for action in incident_trigger.alert_rule_trigger.alertruletriggeraction_set.all():
            handle_trigger_action.apply_async(
                kwargs={
                    "action_id": action.id,
                    "incident_id": incident_trigger.incident_id,
                    "project_id": self.subscription.project_id,
                    "metric_value": metric_value,
                    "method": method,
                },
                countdown=5,
            )

    def handle_incident_severity_update(self):
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

    def update_alert_rule_stats(self):
        """
        Updates stats about the alert rule, if they're changed.
        :return:
        """
        updated_trigger_alert_counts = {
            trigger_id: alert_count
            for trigger_id, alert_count in self.trigger_alert_counts.items()
            if alert_count != self.orig_trigger_alert_counts[trigger_id]
        }
        resolve_counts = None
        if self.rule_resolve_counts != self.orig_rule_resolve_counts:
            resolve_counts = self.rule_resolve_counts

        update_alert_rule_stats(
            self.alert_rule,
            self.subscription,
            self.last_update,
            updated_trigger_alert_counts,
            resolve_counts,
        )


def build_alert_rule_stat_keys(alert_rule, subscription):
    """
    Builds keys for fetching stats about alert rules
    :return: A list containing the alert rule stat keys
    """
    key_base = ALERT_RULE_BASE_KEY % (alert_rule.id, subscription.project_id)
    return [ALERT_RULE_BASE_STAT_KEY % (key_base, stat_key) for stat_key in ALERT_RULE_STAT_KEYS]


def build_trigger_stat_keys(alert_rule, subscription, triggers):
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


def build_alert_rule_trigger_stat_key(alert_rule_id, project_id, trigger_id, stat_key):
    key_base = ALERT_RULE_BASE_KEY % (alert_rule_id, project_id)
    return ALERT_RULE_BASE_TRIGGER_STAT_KEY % (key_base, trigger_id, stat_key)


def partition(iterable, n):
    """
    Partitions an iterable into tuples of size n. Expects the iterable length to be a
    multiple of n.
    partition('ABCDEF', 3) --> [('ABC', 'DEF')]
    """
    assert len(iterable) % n == 0
    args = [iter(iterable)] * n
    return zip(*args)


def get_alert_rule_stats(alert_rule, subscription, triggers):
    """
    Fetches stats about the alert rule, specific to the current subscription
    :return: A tuple containing the stats about the alert rule and subscription.
     - last_update: Int representing the timestamp it was last updated
     - trigger_alert_counts: A dict of trigger alert counts, where the key is the
       trigger id, and the value is an int representing how many consecutive times we
       have triggered the alert threshold
     - rule_resolve_counts: An int representing how many consecutive times we have
       triggered the resolve threshold
    """

    alert_rule_keys = build_alert_rule_stat_keys(alert_rule, subscription)
    trigger_keys = build_trigger_stat_keys(alert_rule, subscription, triggers)
    results = get_redis_client().mget(alert_rule_keys + trigger_keys)
    results = tuple(0 if result is None else int(result) for result in results)
    last_update = to_datetime(results[0])
    rule_resolve_counts = results[1]
    trigger_results = results[2:]
    trigger_alert_counts = {}
    for trigger, trigger_result in zip(triggers, trigger_results):
        trigger_alert_counts[trigger.id] = trigger_result

    return last_update, trigger_alert_counts, rule_resolve_counts


def update_alert_rule_stats(
    alert_rule, subscription, last_update, alert_counts, resolve_count=None
):
    """
    Updates stats about the alert rule, subscription and triggers if they've changed.
    """
    pipeline = get_redis_client().pipeline()

    counts_with_stat_keys = zip(ALERT_RULE_TRIGGER_STAT_KEYS, (alert_counts,))
    for stat_key, trigger_counts in counts_with_stat_keys:
        for trigger_id, alert_count in trigger_counts.items():
            pipeline.set(
                build_alert_rule_trigger_stat_key(
                    alert_rule.id, subscription.project_id, trigger_id, stat_key
                ),
                alert_count,
                ex=REDIS_TTL,
            )

    last_update_key, resolve_count_key = build_alert_rule_stat_keys(alert_rule, subscription)
    pipeline.set(last_update_key, int(to_timestamp(last_update)), ex=REDIS_TTL)
    if resolve_count is not None:
        pipeline.set(resolve_count_key, resolve_count, ex=REDIS_TTL)
    pipeline.execute()


def get_redis_client():
    cluster_key = getattr(settings, "SENTRY_INCIDENT_RULES_REDIS_CLUSTER", "default")
    return redis.redis_clusters.get(cluster_key)
