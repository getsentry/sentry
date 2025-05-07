from datetime import timedelta

import pytest
from django.db import IntegrityError
from django.utils import timezone

from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.testutils.cases import TestMigrations
from sentry.types.group import GroupSubStatus
from sentry.workflow_engine.models import IncidentGroupOpenPeriod


@pytest.mark.skip(
    "Could cause timeout failures—skipping these tests, which pass, to unblock migration."
)
class AddIncidentIdentifierTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0057_workflowengine_rename_column"
    migrate_to = "0058_add_inc_identifier_incidentgroupopenperiod"

    def setUp(self):
        return super().setUp()

    def setup_initial_state(self):
        self.now = timezone.now()
        self.alert_rule = self.create_alert_rule()
        self.incident = self.create_incident(alert_rule=self.alert_rule, date_started=self.now)

        self.unresolved_group_with_open_period = Group.objects.create(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            first_seen=self.now - timedelta(days=5),
        )
        self.group_open_period = GroupOpenPeriod.objects.create(
            group=self.unresolved_group_with_open_period,
            project=self.project,
            date_started=self.unresolved_group_with_open_period.first_seen,
        )

    def test_simple(self):
        IncidentGroupOpenPeriod.objects.create(
            incident_id=self.incident.id,
            incident_identifier=self.incident.identifier,
            group_open_period=self.group_open_period,
        )

    def test_constraint(self):
        with pytest.raises(IntegrityError):
            IncidentGroupOpenPeriod.objects.create(
                incident_id=self.incident.id, group_open_period=self.group_open_period
            )
