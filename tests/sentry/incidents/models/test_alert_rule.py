import unittest
from datetime import timedelta
from unittest import mock
from unittest.mock import Mock, patch

import pytest
from django.core.cache import cache
from django.utils import timezone

from sentry.incidents.logic import delete_alert_rule, update_alert_rule
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleActivity,
    AlertRuleActivityType,
    AlertRuleMonitorTypeInt,
    AlertRuleStatus,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
    alert_subscription_callback_registry,
    register_alert_subscription_callback,
    update_alert_activations,
)
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.utils.types import AlertRuleActivationConditionType
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.alert_rule import TemporaryAlertRuleTriggerActionRegistry
from sentry.users.services.user.service import user_service


class IncidentGetForSubscriptionTest(TestCase):
    def test(self):
        alert_rule = self.create_alert_rule()
        assert alert_rule.snuba_query is not None
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
        assert self.alert_rule.snuba_query is not None
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
        subscription_id = self.subscription.id
        self.subscription.delete()
        assert cache.get(AlertRule.objects.CACHE_SUBSCRIPTION_KEY % self.subscription.id) is None

        # Add the subscription id back in so we don't use `None` in the lookup check.
        self.subscription.id = subscription_id
        with pytest.raises(AlertRule.DoesNotExist):
            AlertRule.objects.get_for_subscription(self.subscription)

    def test_deleted_alert_rule(self):
        AlertRule.objects.get_for_subscription(self.subscription)
        assert (
            cache.get(AlertRule.objects.CACHE_SUBSCRIPTION_KEY % self.subscription.id)
            == self.alert_rule
        )
        delete_alert_rule(self.alert_rule)
        assert cache.get(AlertRule.objects.CACHE_SUBSCRIPTION_KEY % self.subscription.id) is None
        with pytest.raises(AlertRule.DoesNotExist):
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


class AlertRuleTest(TestCase):
    @patch("sentry.incidents.models.alert_rule.bulk_create_snuba_subscriptions")
    def test_subscribes_projects_to_alert_rule(self, mock_bulk_create_snuba_subscriptions):
        # eg. creates QuerySubscription's/SnubaQuery's for AlertRule + Project
        alert_rule = self.create_alert_rule(monitor_type=AlertRuleMonitorTypeInt.ACTIVATED)
        assert mock_bulk_create_snuba_subscriptions.call_count == 0

        alert_rule.subscribe_projects(
            projects=[self.project],
            monitor_type=AlertRuleMonitorTypeInt.ACTIVATED,
            activator="testing",
            activation_condition=AlertRuleActivationConditionType.RELEASE_CREATION,
        )
        assert mock_bulk_create_snuba_subscriptions.call_count == 1

    def test_conditionally_subscribe_project_to_alert_rules(self):
        query_extra = "foo:bar"
        project = self.create_project(name="foo")
        self.create_alert_rule(
            projects=[project],
            monitor_type=AlertRuleMonitorTypeInt.ACTIVATED,
            activation_condition=AlertRuleActivationConditionType.DEPLOY_CREATION,
        )
        with self.tasks():
            created_subscriptions = (
                AlertRule.objects.conditionally_subscribe_project_to_alert_rules(
                    project=project,
                    activation_condition=AlertRuleActivationConditionType.DEPLOY_CREATION,
                    query_extra=query_extra,
                    origin="test",
                    activator="testing",
                )
            )
            assert len(created_subscriptions) == 1

            sub = created_subscriptions[0]
            fetched_sub = QuerySubscription.objects.get(id=sub.id)
            assert fetched_sub.subscription_id is not None

    def test_conditionally_subscribing_project_initializes_activation(self):
        query_extra = "foo:bar"
        project = self.create_project(name="foo")
        alert_rule = self.create_alert_rule(
            projects=[project],
            monitor_type=AlertRuleMonitorTypeInt.ACTIVATED,
            activation_condition=AlertRuleActivationConditionType.DEPLOY_CREATION,
        )

        with self.tasks():
            created_subscriptions = (
                AlertRule.objects.conditionally_subscribe_project_to_alert_rules(
                    project=project,
                    activation_condition=AlertRuleActivationConditionType.DEPLOY_CREATION,
                    query_extra=query_extra,
                    origin="test",
                    activator="testing",
                )
            )
            assert len(created_subscriptions) == 1

            sub = created_subscriptions[0]
            activations = alert_rule.activations.all()
            assert len(activations) == 1
            current_activation = activations[0]
            assert current_activation.query_subscription == sub
            assert current_activation.is_complete() is False


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
        assert {alert_rule1, alert_rule2} == set(
            AlertRule.objects.fetch_for_organization(self.organization, [project])
        )

    def test_project_on_alert(self):
        project = self.create_project()
        alert_rule = self.create_alert_rule()
        alert_rule.projects.add(project)

        assert [alert_rule] == list(AlertRule.objects.fetch_for_organization(self.organization))

    def test_project_on_alert_and_snuba(self):
        project1 = self.create_project()
        alert_rule1 = self.create_alert_rule(projects=[project1])
        alert_rule1.projects.add(project1)

        # will fetch if there's 1 project in snuba
        assert [alert_rule1] == list(AlertRule.objects.fetch_for_organization(self.organization))

        project2 = self.create_project()
        alert_rule2 = self.create_alert_rule(projects=[project2, self.project])
        alert_rule2.projects.add(project1)

        # Will fetch if there's 1 project in snuba and 1 in alert rule
        assert {alert_rule1, alert_rule2} == set(
            AlertRule.objects.fetch_for_organization(self.organization, [project1])
        )


class AlertRuleTriggerActionTargetTest(TestCase):
    def test_user(self):
        trigger = AlertRuleTriggerAction(
            target_type=AlertRuleTriggerAction.TargetType.USER.value,
            target_identifier=str(self.user.id),
        )
        assert trigger.target == user_service.get_user(user_id=self.user.id)

    def test_invalid_user(self):
        trigger = AlertRuleTriggerAction(
            target_type=AlertRuleTriggerAction.TargetType.USER.value, target_identifier="10000000"
        )
        assert trigger.target is None

    def test_team(self):
        trigger = AlertRuleTriggerAction(
            target_type=AlertRuleTriggerAction.TargetType.TEAM.value,
            target_identifier=str(self.team.id),
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


class AlertRuleTriggerActionActivateBaseTest:
    method: str

    def setUp(self):
        self.suspended_registry = TemporaryAlertRuleTriggerActionRegistry.suspend()

    def tearDown(self):
        self.suspended_registry.restore()

    def test_no_handler(self):
        trigger = AlertRuleTriggerAction(type=AlertRuleTriggerAction.Type.EMAIL.value)
        result = trigger.fire(Mock(), Mock(), Mock(), 123, IncidentStatus.CRITICAL)  # type: ignore[func-returns-value]

        # TODO(RyanSkonnord): Remove assertion (see test_handler)
        assert result is None

    def test_handler(self):
        mock_handler = Mock()
        mock_method = getattr(mock_handler.return_value, self.method)
        mock_method.return_value = "test"
        type = AlertRuleTriggerAction.Type.EMAIL
        AlertRuleTriggerAction.register_type("something", type, [])(mock_handler)
        trigger = AlertRuleTriggerAction(type=type.value)
        result = getattr(trigger, self.method)(Mock(), Mock(), Mock(), 123, IncidentStatus.CRITICAL)

        # TODO(RyanSkonnord): Don't assert on return value.
        # All concrete ActionHandlers return None from their fire and resolve
        # methods. It seems that this return value's only purpose is to spy on
        # whether the AlertRuleTriggerAction produced a handler.
        assert result == mock_method.return_value


class AlertRuleTriggerActionFireTest(AlertRuleTriggerActionActivateBaseTest, unittest.TestCase):
    method = "fire"


class AlertRuleTriggerActionResolveTest(AlertRuleTriggerActionActivateBaseTest, unittest.TestCase):
    method = "resolve"


class AlertRuleTriggerActionActivateTest(TestCase):
    @pytest.fixture(autouse=True)
    def _setup_metric_patch(self):
        with mock.patch("sentry.incidents.models.alert_rule.metrics") as self.metrics:
            yield

    def setUp(self):
        self.suspended_registry = TemporaryAlertRuleTriggerActionRegistry.suspend()

    def tearDown(self):
        self.suspended_registry.restore()

    def test_unhandled(self):
        trigger = AlertRuleTriggerAction(type=AlertRuleTriggerAction.Type.EMAIL.value)
        trigger.build_handler(Mock(), Mock(), Mock())
        self.metrics.incr.assert_called_once_with("alert_rule_trigger.unhandled_type.0")

    def test_handled(self):
        mock_handler = Mock()
        type = AlertRuleTriggerAction.Type.EMAIL
        AlertRuleTriggerAction.register_type("something", type, [])(mock_handler)

        trigger = AlertRuleTriggerAction(type=AlertRuleTriggerAction.Type.EMAIL.value)
        incident = Mock()
        project = Mock()
        trigger.build_handler(trigger, incident, project)
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


class UpdateAlertActivationsTest(TestCase):
    def test_updates_non_expired_alerts(self):
        with self.tasks():
            alert_rule = self.create_alert_rule(monitor_type=AlertRuleMonitorTypeInt.ACTIVATED)
            alert_rule.subscribe_projects(
                projects=[self.project],
                monitor_type=AlertRuleMonitorTypeInt.ACTIVATED,
                activation_condition=AlertRuleActivationConditionType.RELEASE_CREATION,
                activator="testing",
            )
            assert alert_rule.snuba_query is not None
            subscription = alert_rule.snuba_query.subscriptions.get()
            activation = alert_rule.activations.get()
            assert activation.finished_at is None
            assert activation.metric_value is None

            expected_value = 10
            result = update_alert_activations(
                subscription=subscription, alert_rule=alert_rule, value=expected_value
            )
            assert result is True
            assert QuerySubscription.objects.filter(id=subscription.id).exists()
            activation = alert_rule.activations.get()
            # assert activation.is_complete() is True # TODO: enable once we've implemented is_complete()
            assert activation.finished_at is None
            assert activation.metric_value == expected_value

    def test_cleans_expired_alerts(self):
        with self.tasks():
            alert_rule = self.create_alert_rule(monitor_type=AlertRuleMonitorTypeInt.ACTIVATED)
            alert_rule.subscribe_projects(
                projects=[self.project],
                monitor_type=AlertRuleMonitorTypeInt.ACTIVATED,
                activation_condition=AlertRuleActivationConditionType.RELEASE_CREATION,
                activator="testing",
            )

            assert alert_rule.snuba_query is not None
            subscription = alert_rule.snuba_query.subscriptions.get()
            subscription.date_added = timezone.now() - timedelta(days=21)

            expected_value = 10
            result = update_alert_activations(
                subscription=subscription, alert_rule=alert_rule, value=expected_value
            )

            assert result is True
            assert subscription.status == QuerySubscription.Status.DELETING.value
            assert not QuerySubscription.objects.filter(id=subscription.id).exists()
            activation = alert_rule.activations.get()
            # assert activation.is_complete() is True # TODO: enable once we've implemented is_complete()
            assert activation.finished_at is not None
            assert activation.metric_value == expected_value

    def test_update_alerts_add_processor(self):
        @register_alert_subscription_callback(AlertRuleMonitorTypeInt.CONTINUOUS)
        def mock_processor(_subscription, alert_rule, value):
            # everything other than subscription is passed as a kwarg
            return True

        assert AlertRuleMonitorTypeInt.CONTINUOUS in alert_subscription_callback_registry
        assert (
            alert_subscription_callback_registry[AlertRuleMonitorTypeInt.CONTINUOUS]
            == mock_processor
        )

    def test_update_alerts_execute_processor(self):
        alert_rule = self.create_alert_rule(monitor_type=AlertRuleMonitorTypeInt.CONTINUOUS)
        assert alert_rule.snuba_query is not None
        subscription = alert_rule.snuba_query.subscriptions.get()

        callback = alert_subscription_callback_registry[AlertRuleMonitorTypeInt.CONTINUOUS]
        result = callback(subscription, alert_rule=alert_rule, value=10)
        assert result is True


class AlertRuleFetchForProjectTest(TestCase):
    def test_simple(self):
        project = self.create_project()
        alert_rule = self.create_alert_rule(projects=[project])

        assert [alert_rule] == list(AlertRule.objects.fetch_for_project(project))

    def test_projects_on_snuba_and_alert(self):
        project1 = self.create_project()
        alert_rule1 = self.create_alert_rule(projects=[project1, self.project])

        project2 = self.create_project()
        alert_rule2 = self.create_alert_rule(projects=[project2, self.project])
        alert_rule2.projects.add(project2)

        assert {alert_rule1, alert_rule2} == set(AlertRule.objects.fetch_for_project(self.project))
