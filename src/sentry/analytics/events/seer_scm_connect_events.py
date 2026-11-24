from sentry import analytics


@analytics.eventclass("seer.scm_connect.shown")
class SeerScmConnectShownEvent(analytics.Event):
    """A Seer chat paused to ask its owner to fix access to a repository it couldn't open."""

    organization_id: int
    user_id: int | None
    run_id: int
    # The pause's id: one per popup, shared with its `seer.scm_connect.resolved`.
    input_id: str
    # Why Seer couldn't open the repository, e.g. `no_scm_integration`.
    failure_reason: str
    can_install_integrations: bool


@analytics.eventclass("seer.scm_connect.resolved")
class SeerScmConnectResolvedEvent(analytics.Event):
    """The popup closed: its owner answered it or sent a new message."""

    organization_id: int
    user_id: int | None
    run_id: int
    input_id: str
    failure_reason: str
    # `retry`, `correct_repo`, `skip` or `new_message`.
    resolution: str
    # Whether Seer could open the repository when the popup closed: `found`, a failure reason,
    # or `unknown`. For `correct_repo`, this is the name the user gave.
    repo_status: str
    seconds_open: int


analytics.register(SeerScmConnectShownEvent)
analytics.register(SeerScmConnectResolvedEvent)
