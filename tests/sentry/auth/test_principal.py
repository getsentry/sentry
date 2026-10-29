from django.contrib.auth.models import AnonymousUser

from sentry.auth.principal import RequestPrincipal, get_current_actor, resolve_actor
from sentry.auth.services.auth import AuthenticatedToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.viewer_context import Actor, ActorType, ViewerContext, viewer_context_scope


@all_silo_test
class RequestPrincipalTest(TestCase):
    def test_user(self) -> None:
        principal: RequestPrincipal = self.user
        assert principal.user_id == self.user.id

    def test_rpc_user(self) -> None:
        principal: RequestPrincipal = serialize_rpc_user(self.user)
        assert principal.user_id == self.user.id

    def test_anonymous(self) -> None:
        principal: RequestPrincipal = AnonymousUser()
        assert principal.user_id is None
        assert not principal.is_sentry_app
        assert principal.get_display_name() == ""


@all_silo_test
class ResolveActorTest(TestCase):
    def test_user(self) -> None:
        assert resolve_actor(self.user, None) == Actor(type=ActorType.USER, actor_id=self.user.id)

    def test_anonymous(self) -> None:
        assert resolve_actor(AnonymousUser(), None) is None

    def test_credential_without_user(self) -> None:
        assert resolve_actor(AnonymousUser(), AuthenticatedToken(kind="org_auth_token")) is None

    def test_agent_token(self) -> None:
        auth = AuthenticatedToken(kind="agent_token", user_id=self.user.id)
        actor = resolve_actor(serialize_rpc_user(self.user), auth)
        assert actor == Actor(type=ActorType.AGENT, delegated_user_id=self.user.id)


class GetCurrentActorTest(TestCase):
    def test_no_viewer_context(self) -> None:
        with viewer_context_scope(None):
            assert get_current_actor() is None

    def test_unknown_actor(self) -> None:
        with viewer_context_scope(ViewerContext(actor=Actor(type=ActorType.UNKNOWN))):
            assert get_current_actor() is None

    def test_actor(self) -> None:
        actor = Actor(type=ActorType.USER, actor_id=self.user.id)
        with viewer_context_scope(ViewerContext(actor=actor)):
            assert get_current_actor() == actor
