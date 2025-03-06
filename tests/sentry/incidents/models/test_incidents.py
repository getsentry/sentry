import unittest
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.db import router, transaction
from django.utils import timezone

from sentry.db.models.manager.base import BaseManager
from sentry.incidents.models.incident import (
    Incident,
    IncidentStatus,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


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


class ActiveIncidentClearCacheTest(TestCase):
    def setUp(self):
        self.alert_rule = self.create_alert_rule()
        self.trigger = self.create_alert_rule_trigger(self.alert_rule)

    def test_negative_cache(self):
        subscription = self.alert_rule.snuba_query.subscriptions.get()
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    alert_rule_id=self.alert_rule.id,
                    project_id=self.project.id,
                    subscription_id=subscription.id,
                )
            )
            is None
        )
        Incident.objects.get_active_incident(self.alert_rule, self.project, subscription)
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    alert_rule_id=self.alert_rule.id,
                    project_id=self.project.id,
                    subscription_id=subscription.id,
                )
            )
            is False
        )
        self.create_incident(status=IncidentStatus.CLOSED.value)
        self.alert_rule.save()
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    alert_rule_id=self.alert_rule.id,
                    project_id=self.project.id,
                    subscription_id=subscription.id,
                )
            )
        ) is False

    def test_cache(self):
        subscription = self.alert_rule.snuba_query.subscriptions.get()
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    alert_rule_id=self.alert_rule.id,
                    project_id=self.project.id,
                    subscription_id=subscription.id,
                )
            )
            is None
        )
        active_incident = self.create_incident(
            alert_rule=self.alert_rule, projects=[self.project], subscription=subscription
        )
        Incident.objects.get_active_incident(self.alert_rule, self.project, subscription)
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    alert_rule_id=self.alert_rule.id,
                    project_id=self.project.id,
                    subscription_id=subscription.id,
                )
            )
            == active_incident
        )
        active_incident = self.create_incident(
            alert_rule=self.alert_rule, projects=[self.project], subscription=subscription
        )
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    alert_rule_id=self.alert_rule.id,
                    project_id=self.project.id,
                    subscription_id=subscription.id,
                )
            )
            is None
        )
        Incident.objects.get_active_incident(self.alert_rule, self.project, subscription)
        assert (
            cache.get(
                Incident.objects._build_active_incident_cache_key(
                    alert_rule_id=self.alert_rule.id,
                    project_id=self.project.id,
                    subscription_id=subscription.id,
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
                with transaction.atomic(router.db_for_write(Incident)):
                    incident = Incident.objects.create(
                        self.organization,
                        status=IncidentStatus.OPEN.value,
                        title="Conflicting Incident",
                        type=IncidentType.ALERT_TRIGGERED.value,
                        alert_rule=alert_rule,
                    )
                assert incident.identifier == kwargs["identifier"]
                create_method(*args, **kwargs)
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


@freeze_time()
class IncidentCurrentEndDateTest(unittest.TestCase):
    def test(self):
        incident = Incident()
        assert incident.current_end_date == timezone.now()
        incident.date_closed = timezone.now() - timedelta(minutes=10)
        assert incident.current_end_date == timezone.now() - timedelta(minutes=10)
