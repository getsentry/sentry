import abc

from sentry.incidents.logic import update_incident_status
from sentry.incidents.models.incident import Incident, IncidentStatus, IncidentStatusMethod
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import TestCase


class FireTest(TestCase, abc.ABC):
    __test__ = Abstract(__module__, __qualname__)

    @abc.abstractmethod
    def run_test(self, incident: Incident, method: str, **kwargs):
        pass

    def run_fire_test(self, method="fire", chart_url=None, status=IncidentStatus.CLOSED):
        kwargs = {}
        if chart_url:
            kwargs = {"chart_url": chart_url}

        self.alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=self.alert_rule, status=status.value)
        if method == "resolve":
            update_incident_status(
                incident, IncidentStatus.CLOSED, status_method=IncidentStatusMethod.MANUAL
            )
        return self.run_test(incident, method, **kwargs)
