from sentry import analytics


@analytics.eventclass("agent_handoff.prompt_created")
class AgentHandoffPromptCreatedEvent(analytics.Event):
    user_id: int
    organization_id: int
    flow: str
    run_id: str | None = None
    ip_pinning: bool


@analytics.eventclass("agent_handoff.claimed")
class AgentHandoffClaimedEvent(analytics.Event):
    outcome: str
    # Unrecognized and already claimed codes cannot be attributed to a handoff.
    user_id: int | None = None
    organization_id: int | None = None
    flow: str | None = None
    run_id: str | None = None


analytics.register(AgentHandoffPromptCreatedEvent)
analytics.register(AgentHandoffClaimedEvent)
