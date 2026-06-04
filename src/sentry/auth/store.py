from sentry.pipeline.store import PipelineSessionStore
from sentry.utils.session_store import redis_property

# logging in or registering
FLOW_LOGIN = 1
# configuring the provider
FLOW_SETUP_PROVIDER = 2


class AuthHelperSessionStore(PipelineSessionStore):
    redis_namespace = "auth"

    @property
    def session_key(self) -> str:
        return "auth_key"

    flow = redis_property("flow")
    referrer = redis_property("referrer")

    def mark_session(self) -> None:
        super().mark_session()
        self.request.session.modified = True

    def is_valid(self) -> bool:
        return super().is_valid() and self.flow in (FLOW_LOGIN, FLOW_SETUP_PROVIDER)
