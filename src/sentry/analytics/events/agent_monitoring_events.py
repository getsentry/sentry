from typing import int
from sentry import analytics


@analytics.eventclass("agent_monitoring.query")
class AgentMonitoringQuery(analytics.Event):
    organization_id: int
    referrer: str


analytics.register(AgentMonitoringQuery)
