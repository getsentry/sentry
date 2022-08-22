import abc

from sentry.incidents.logic import update_incident_status
from sentry.incidents.models import Incident, IncidentStatus, IncidentStatusMethod


class FireTest(abc.ABC):
    @abc.abstractmethod
    def run_test(self, incident: Incident, method: str):
        pass

    def run_fire_test(self, method="fire", chart_url=None):
        self.alert_rule = self.create_alert_rule()
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.CLOSED.value
        )
        if method == "resolve":
            update_incident_status(
                incident, IncidentStatus.CLOSED, status_method=IncidentStatusMethod.MANUAL
            )
        self.run_test(incident, method)
