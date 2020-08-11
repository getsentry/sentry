from __future__ import absolute_import

import unittest
from datetime import timedelta

import six
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone
from exam import patcher
from freezegun import freeze_time
from sentry.utils.compat.mock import Mock, patch

from sentry.db.models.manager import BaseManager
from sentry.incidents.models import (
    AlertRule,
    AlertRuleActivity,
    AlertRuleActivityType,
    AlertRuleStatus,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    Incident,
    IncidentStatus,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.incidents.logic import delete_alert_rule, update_alert_rule
from sentry.testutils import TestCase


class FetchForOrganizationTest(TestCase):
    def test_empty(self):
        incidents = Incident.objects.fetch_for_organization(self.organization, [self.project])
        assert [] == list(incidents)
        self.create_project()

    def test_simple(self):
        incident = self.create_incident()

        assert [incident] == list(
            Incident.objects.fetch_for_organization(self.organization, [self.project])
        )

    def test_invalid_project(self):
        project = self.create_project()
        incident = self.create_incident(projects=[project])

        assert [] == list(
            Incident.objects.fetch_for_organization(self.organization, [self.project])
        )
        assert [incident] == list(
            Incident.objects.fetch_for_organization(self.organization, [project])
        )

    def test_multi_project(self):
        project = self.create_project()
        incident = self.create_incident(projects=[project, self.project])

        assert [incident] == list(
            Incident.objects.fetch_for_organization(self.organization, [self.project])
        )
        assert [incident] == list(
            Incident.objects.fetch_for_organization(self.organization, [project])
        )
        assert [incident] == list(
            Incident.objects.fetch_for_organization(self.organization, [self.project, project])
        )


class IncidentGetForSubscriptionTest(TestCase):
    def test(self):
        alert_rule = self.create_alert_rule()
        subscription = alert_rule.snuba_query.subscriptions.get()
        # First test fetching from database
        assert cache.get(AlertRule.objects.CACHE_SUBSCRIPTION_KEY % subscription.id) is None
        assert AlertRule.objects.get_for_subscription(subscription) == alert_rule

        # Now test fetching from cache
        assert cache.get(AlertRule.objects.CACHE_SUBSCRIPTION_KEY % subscription.id) == alert_rule
        assert AlertRule.objects.get_for_subscription(subscription) == alert_rule


class IncidentClearSubscriptionCacheTest(TestCase):
    def setUp(self):
        self.alert_rule = self.create_alert_rule()
        self.subscription = self.alert_rule.snuba_query.subscriptions.get()

    def test_updated_subscription(self):
        AlertRule.objects.get_for_subscription(self.subscription)
        assert (
            cache.get(AlertRule.objects.CACHE_SUBSCRIPTION_KEY % self.subscription.id)
            == self.alert_rule
        )
        self.subscription.save()
        assert cache.get(AlertRule.objects.CACHE_SUBSCRIPTION_KEY % self.subscription.id) is None

    def test_deleted_subscription(self):
        AlertRule.objects.get_for_subscription(self.subscription)
        assert (
            cache.get(AlertRule.objects.CACHE_SUBSCRIPTION_KEY % self.subscription.id)
            == self.alert_rule
        )
        self.subscription.delete()
        with self.assertRaises(AlertRule.DoesNotExist):
            AlertRule.objects.get_for_subscription(self.subscription)

    def test_deleted_alert_rule(self):
        AlertRule.objects.get_for_subscription(self.subscription)
        assert (
            cache.get(AlertRule.objects.CACHE_SUBSCRIPTION_KEY % self.subscription.id)
            == self.alert_rule
        )
        delete_alert_rule(self.alert_rule)
        with self.assertRaises(AlertRule.DoesNotExist):
            AlertRule.objects.get_for_subscription(self.subscription)


class AlertRuleTriggerClearCacheTest(TestCase):
    def setUp(self):
        self.alert_rule = self.create_alert_rule()
        self.trigger = self.create_alert_rule_trigger(self.alert_rule)

    def test_updated_alert_rule(self):
        AlertRuleTrigger.objects.get_for_alert_rule(self.alert_rule)
        assert cache.get(AlertRuleTrigger.objects._build_trigger_cache_key(self.alert_rule.id)) == [
            self.trigger
        ]
        self.alert_rule.save()
        assert (
            cache.get(AlertRuleTrigger.objects._build_trigger_cache_key(self.alert_rule.id))
        ) is None

    def test_deleted_alert_rule(self):
        AlertRuleTrigger.objects.get_for_alert_rule(self.alert_rule)
        assert cache.get(AlertRuleTrigger.objects._build_trigger_cache_key(self.alert_rule.id)) == [
            self.trigger
        ]
        alert_rule_id = self.alert_rule.id
        self.alert_rule.delete()
        assert (cache.get(AlertRuleTrigger.objects._build_trigger_cache_key(alert_rule_id))) is None

    def test_updated_alert_rule_trigger(self):
        AlertRuleTrigger.objects.get_for_alert_rule(self.alert_rule)
        assert cache.get(AlertRuleTrigger.objects._build_trigger_cache_key(self.alert_rule.id)) == [
            self.trigger
        ]
        self.trigger.save()
        assert (
            cache.get(AlertRuleTrigger.objects._build_trigger_cache_key(self.alert_rule.id))
        ) is None

    def test_deleted_alert_rule_trigger(self):
        AlertRuleTrigger.objects.get_for_alert_rule(self.alert_rule)
        assert cache.get(AlertRuleTrigger.objects._build_trigger_cache_key(self.alert_rule.id)) == [
            self.trigger
        ]
        self.trigger.delete()
        assert (
            cache.get(AlertRuleTrigger.objects._build_trigger_cache_key(self.alert_rule.id))
        ) is None


class ActiveIncidentClearCacheTest(TestCase):
    def setUp(self):
        self.alert_rule = self.create_alert_rule()
        self.trigger = self.create_alert_rule_trigger(self.alert_rule)

    def test_negative_cache(self):
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    self.alert_rule.id, self.project.id
                )
            )
            is None
        )
        Incident.objects.get_active_incident(self.alert_rule, self.project)
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    self.alert_rule.id, self.project.id
                )
            )
            is False
        )
        self.create_incident(status=IncidentStatus.CLOSED.value)
        self.alert_rule.save()
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    self.alert_rule.id, self.project.id
                )
            )
        ) is False

    def test_cache(self):
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    self.alert_rule.id, self.project.id
                )
            )
            is None
        )
        active_incident = self.create_incident(alert_rule=self.alert_rule, projects=[self.project])
        Incident.objects.get_active_incident(self.alert_rule, self.project)
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    self.alert_rule.id, self.project.id
                )
            )
            == active_incident
        )
        active_incident = self.create_incident(alert_rule=self.alert_rule, projects=[self.project])
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    self.alert_rule.id, self.project.id
                )
            )
            is None
        )
        Incident.objects.get_active_incident(self.alert_rule, self.project)
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    self.alert_rule.id, self.project.id
                )
            )
            == active_incident
        )


class IncidentTriggerClearCacheTest(TestCase):
    def setUp(self):
        self.alert_rule = self.create_alert_rule()
        self.trigger = self.create_alert_rule_trigger(self.alert_rule)
        self.incident = self.create_incident(alert_rule=self.alert_rule, projects=[self.project])

    def test_deleted_incident(self):
        incident_trigger = IncidentTrigger.objects.create(
            incident=self.incident,
            alert_rule_trigger=self.trigger,
            status=TriggerStatus.ACTIVE.value,
        )
        IncidentTrigger.objects.get_for_incident(self.incident)
        assert cache.get(IncidentTrigger.objects._build_cache_key(self.incident.id)) == [
            incident_trigger
        ]
        self.incident.delete()
        assert cache.get(IncidentTrigger.objects._build_cache_key(self.incident.id)) is None

    def test_updated_incident_trigger(self):
        IncidentTrigger.objects.get_for_incident(self.incident)
        assert cache.get(IncidentTrigger.objects._build_cache_key(self.incident.id)) == []
        incident_trigger = IncidentTrigger.objects.create(
            incident=self.incident,
            alert_rule_trigger=self.trigger,
            status=TriggerStatus.ACTIVE.value,
        )
        IncidentTrigger.objects.get_for_incident(self.incident)
        assert cache.get(IncidentTrigger.objects._build_cache_key(self.incident.id)) == [
            incident_trigger
        ]

    def test_deleted_incident_trigger(self):
        incident_trigger = IncidentTrigger.objects.create(
            incident=self.incident,
            alert_rule_trigger=self.trigger,
            status=TriggerStatus.ACTIVE.value,
        )
        IncidentTrigger.objects.get_for_incident(self.incident)
        assert cache.get(IncidentTrigger.objects._build_cache_key(self.incident.id)) == [
            incident_trigger
        ]
        self.trigger.delete()
        assert (cache.get(IncidentTrigger.objects._build_cache_key(self.incident.id))) is None


class IncidentCreationTest(TestCase):
    def test_simple(self):
        title = "hello"
        alert_rule = self.create_alert_rule()
        incident = Incident.objects.create(
            self.organization,
            title=title,
            type=IncidentType.ALERT_TRIGGERED.value,
            alert_rule=alert_rule,
        )
        assert incident.identifier == 1
        assert incident.title == title

        # Check identifier correctly increments
        incident = Incident.objects.create(
            self.organization,
            title=title,
            type=IncidentType.ALERT_TRIGGERED.value,
            alert_rule=alert_rule,
        )
        assert incident.identifier == 2

    def test_identifier_conflict(self):
        create_method = BaseManager.create
        call_count = [0]
        alert_rule = self.create_alert_rule()

        def mock_base_create(*args, **kwargs):
            if not call_count[0]:
                call_count[0] += 1
                # This incident will take the identifier we already fetched and
                # use it, which will cause the database to throw an integrity
                # error.
                with transaction.atomic():
                    incident = Incident.objects.create(
                        self.organization,
                        status=IncidentStatus.OPEN.value,
                        title="Conflicting Incident",
                        type=IncidentType.ALERT_TRIGGERED.value,
                        alert_rule=alert_rule,
                    )
                assert incident.identifier == kwargs["identifier"]
                try:
                    create_method(*args, **kwargs)
                except IntegrityError:
                    raise
                else:
                    self.fail("Expected an integrity error")
            else:
                call_count[0] += 1

            return create_method(*args, **kwargs)

        self.organization
        with patch.object(BaseManager, "create", new=mock_base_create):
            incident = Incident.objects.create(
                self.organization,
                alert_rule=alert_rule,
                status=IncidentStatus.OPEN.value,
                title="hi",
                type=IncidentType.ALERT_TRIGGERED.value,
            )
            # We should have 3 calls - one for initial create, one for conflict,
            # then the final one for the retry we get due to the conflict
            assert call_count[0] == 3
            # Ideally this would be 2, but because we create the conflicting
            # row inside of a transaction it ends up rolled back. We just want
            # to verify that it was created successfully.
            assert incident.identifier == 1


@freeze_time()
class IncidentDurationTest(unittest.TestCase):
    def test(self):
        incident = Incident(date_started=timezone.now() - timedelta(minutes=5))
        assert incident.duration == timedelta(minutes=5)
        incident.date_closed = incident.date_started + timedelta(minutes=2)
        assert incident.duration == timedelta(minutes=2)


class IncidentAlertRuleRelationTest(TestCase):
    def test(self):
        self.alert_rule = self.create_alert_rule()
        self.trigger = self.create_alert_rule_trigger(self.alert_rule)
        self.incident = self.create_incident(alert_rule=self.alert_rule, projects=[self.project])

        assert self.incident.alert_rule.id == self.alert_rule.id
        all_alert_rules = list(AlertRule.objects.all())
        assert self.alert_rule in all_alert_rules

        self.alert_rule.status = AlertRuleStatus.SNAPSHOT.value
        self.alert_rule.save()

        all_alert_rules = list(AlertRule.objects.all())
        assert self.alert_rule not in all_alert_rules
        assert self.incident.alert_rule.id == self.alert_rule.id


@freeze_time()
class IncidentCurrentEndDateTest(unittest.TestCase):
    def test(self):
        incident = Incident()
        assert incident.current_end_date == timezone.now()
        incident.date_closed = timezone.now() - timedelta(minutes=10)
        assert incident.current_end_date == timezone.now() - timedelta(minutes=10)


class AlertRuleFetchForOrganizationTest(TestCase):
    def test_empty(self):
        alert_rule = AlertRule.objects.fetch_for_organization(self.organization)
        assert [] == list(alert_rule)

    def test_simple(self):
        alert_rule = self.create_alert_rule()

        assert [alert_rule] == list(AlertRule.objects.fetch_for_organization(self.organization))

    def test_with_projects(self):
        project = self.create_project()
        alert_rule = self.create_alert_rule(projects=[project])

        assert [] == list(
            AlertRule.objects.fetch_for_organization(self.organization, [self.project])
        )
        assert [alert_rule] == list(
            AlertRule.objects.fetch_for_organization(self.organization, [project])
        )

    def test_multi_project(self):
        project = self.create_project()
        alert_rule1 = self.create_alert_rule(projects=[project, self.project])
        alert_rule2 = self.create_alert_rule(projects=[project])

        assert [alert_rule1] == list(
            AlertRule.objects.fetch_for_organization(self.organization, [self.project])
        )
        assert [alert_rule1, alert_rule2] == list(
            AlertRule.objects.fetch_for_organization(self.organization, [project])
        )


class AlertRuleTriggerActionTargetTest(TestCase):
    def test_user(self):
        trigger = AlertRuleTriggerAction(
            target_type=AlertRuleTriggerAction.TargetType.USER.value,
            target_identifier=six.text_type(self.user.id),
        )
        assert trigger.target == self.user

    def test_invalid_user(self):
        trigger = AlertRuleTriggerAction(
            target_type=AlertRuleTriggerAction.TargetType.USER.value, target_identifier="10000000"
        )
        assert trigger.target is None

    def test_team(self):
        trigger = AlertRuleTriggerAction(
            target_type=AlertRuleTriggerAction.TargetType.TEAM.value,
            target_identifier=six.text_type(self.team.id),
        )
        assert trigger.target == self.team

    def test_invalid_team(self):
        trigger = AlertRuleTriggerAction(
            target_type=AlertRuleTriggerAction.TargetType.TEAM.value, target_identifier="10000000"
        )
        assert trigger.target is None

    def test_specific(self):
        email = "test@test.com"
        trigger = AlertRuleTriggerAction(
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC.value, target_identifier=email
        )
        assert trigger.target == email


class AlertRuleTriggerActionActivateTest(object):
    method = None

    def setUp(self):
        self.old_handlers = AlertRuleTriggerAction._type_registrations
        AlertRuleTriggerAction._type_registrations = {}

    def tearDown(self):
        AlertRuleTriggerAction._type_registrations = self.old_handlers

    def test_no_handler(self):
        trigger = AlertRuleTriggerAction(type=AlertRuleTriggerAction.Type.EMAIL.value)
        assert trigger.fire(Mock(), Mock(), 123) is None

    def test_handler(self):
        mock_handler = Mock()
        mock_method = getattr(mock_handler.return_value, self.method)
        mock_method.return_value = "test"
        type = AlertRuleTriggerAction.Type.EMAIL
        AlertRuleTriggerAction.register_type("something", type, [])(mock_handler)
        trigger = AlertRuleTriggerAction(type=type.value)
        assert getattr(trigger, self.method)(Mock(), Mock(), 123) == mock_method.return_value


class AlertRuleTriggerActionFireTest(AlertRuleTriggerActionActivateTest, unittest.TestCase):
    method = "fire"


class AlertRuleTriggerActionResolveTest(AlertRuleTriggerActionActivateTest, unittest.TestCase):
    method = "resolve"


class AlertRuleTriggerActionActivateTest(TestCase):
    metrics = patcher("sentry.incidents.models.metrics")

    def setUp(self):
        self.old_handlers = AlertRuleTriggerAction._type_registrations
        AlertRuleTriggerAction._type_registrations = {}

    def tearDown(self):
        AlertRuleTriggerAction._type_registrations = self.old_handlers

    def test_unhandled(self):
        trigger = AlertRuleTriggerAction(type=AlertRuleTriggerAction.Type.EMAIL.value)
        trigger.build_handler(Mock(), Mock())
        self.metrics.incr.assert_called_once_with("alert_rule_trigger.unhandled_type.0")

    def test_handled(self):
        mock_handler = Mock()
        type = AlertRuleTriggerAction.Type.EMAIL
        AlertRuleTriggerAction.register_type("something", type, [])(mock_handler)

        trigger = AlertRuleTriggerAction(type=AlertRuleTriggerAction.Type.EMAIL.value)
        incident = Mock()
        project = Mock()
        trigger.build_handler(incident, project)
        mock_handler.assert_called_once_with(trigger, incident, project)
        assert not self.metrics.incr.called


class AlertRuleActivityTest(TestCase):
    def test_simple(self):
        assert AlertRuleActivity.objects.all().count() == 0
        self.alert_rule = self.create_alert_rule()
        assert AlertRuleActivity.objects.filter(
            alert_rule=self.alert_rule, type=AlertRuleActivityType.CREATED.value
        ).exists()

    def test_delete(self):
        assert AlertRuleActivity.objects.all().count() == 0
        self.alert_rule = self.create_alert_rule()
        self.create_incident(alert_rule=self.alert_rule, projects=[self.project])
        delete_alert_rule(self.alert_rule)
        assert AlertRuleActivity.objects.filter(
            alert_rule=self.alert_rule, type=AlertRuleActivityType.DELETED.value
        ).exists()

    def test_update(self):
        assert AlertRuleActivity.objects.all().count() == 0
        self.alert_rule = self.create_alert_rule()
        self.create_incident(alert_rule=self.alert_rule, projects=[self.project])
        update_alert_rule(self.alert_rule, name="updated_name")
        assert AlertRuleActivity.objects.filter(
            previous_alert_rule=self.alert_rule, type=AlertRuleActivityType.SNAPSHOT.value
        ).exists()
        assert AlertRuleActivity.objects.filter(
            alert_rule=self.alert_rule, type=AlertRuleActivityType.UPDATED.value
        ).exists()
