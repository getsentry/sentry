from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.base import SessionBase
from django.test import RequestFactory

from sentry.auth.services.auth import AuthenticatedToken
from sentry.ratelimits.utils import is_session_request
from sentry.seer.agent_token import AGENT_TOKEN_KIND
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of
from sentry.users.models.user import User


@all_silo_test
class IsSessionRequestTest(TestCase):
    def setUp(self) -> None:
        self.request = RequestFactory().get("/")
        self.request.session = SessionBase()

    def test_session_user(self) -> None:
        self.request.user = self.user
        self.request.auth = None

        assert is_session_request(self.request)

    def test_anonymous(self) -> None:
        self.request.user = AnonymousUser()
        self.request.auth = None

        assert not is_session_request(self.request)

    def test_anonymous_with_cookies(self) -> None:
        # `is_frontend_request` calls this a UI request. Cookie contents are caller-controlled, so
        # anything enforced against has to look at resolved auth instead.
        self.request.COOKIES = {"junk": "1"}
        self.request.user = AnonymousUser()
        self.request.auth = None

        assert not is_session_request(self.request)

    def test_api_token(self) -> None:
        with assume_test_silo_mode_of(User):
            token = self.create_user_auth_token(user=self.user, scope_list=["event:read"])
            self.request.auth = AuthenticatedToken.from_token(token)
        self.request.user = self.user

        assert not is_session_request(self.request)

    def test_agent_token(self) -> None:
        self.request.user = self.user
        self.request.auth = AuthenticatedToken(
            kind=AGENT_TOKEN_KIND,
            scopes=["event:read"],
            user_id=self.user.id,
            organization_id=self.organization.id,
        )

        assert not is_session_request(self.request)

    def test_org_auth_token(self) -> None:
        self.request.user = AnonymousUser()
        self.request.auth = AuthenticatedToken.from_token(
            self.create_org_auth_token(organization_id=self.organization.id, scope_list=["org:ci"])
        )

        assert not is_session_request(self.request)

    def test_api_key(self) -> None:
        self.request.user = AnonymousUser()
        self.request.auth = AuthenticatedToken.from_token(
            self.create_api_key(organization=self.organization, scope_list=["project:write"])
        )

        assert not is_session_request(self.request)

    def test_viewer_context(self) -> None:
        self.request.user = self.user
        self.request.auth = None
        self.request.user_from_viewer_context = True

        assert not is_session_request(self.request)

    def test_unpopulated_request(self) -> None:
        assert not is_session_request(RequestFactory().get("/"))
