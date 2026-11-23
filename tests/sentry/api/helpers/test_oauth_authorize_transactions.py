import time

import pytest

from sentry.api.helpers.oauth_authorize.request import build_authorization_request
from sentry.api.helpers.oauth_authorize.response import InvalidAuthorizationRequest
from sentry.api.helpers.oauth_authorize.transactions import (
    OAUTH_AUTHORIZE_SESSION_TTL,
    consume_authorization_transaction,
    prune_authorization_transactions,
    save_authorization_transaction,
)
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AuthorizationTransactionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(redirect_uris="https://example.com/callback")
        self.authorization = build_authorization_request(
            {
                "client_id": self.application.client_id,
                "response_type": "code",
                "scope": "project:read",
                "state": "example-state",
                "code_challenge": "a" * 43,
                "code_challenge_method": "S256",
            }
        )

    def test_parallel_transactions_and_replay(self) -> None:
        session = self.client.session
        first = save_authorization_transaction(session, self.authorization, self.user.id)
        second = save_authorization_transaction(session, self.authorization, self.user.id)

        assert consume_authorization_transaction(session, first, self.user.id) == self.authorization
        with pytest.raises(InvalidAuthorizationRequest):
            consume_authorization_transaction(session, first, self.user.id)
        assert (
            consume_authorization_transaction(session, second, self.user.id) == self.authorization
        )

    def test_expiry_and_device_namespace(self) -> None:
        session = self.client.session
        expired = save_authorization_transaction(session, self.authorization, self.user.id)
        session[f"oa2:{expired}"]["ts"] = time.time() - OAUTH_AUTHORIZE_SESSION_TTL - 1
        session["oa2:ABCD-EFGH"] = {"device_code_id": 123, "user_id": self.user.id}

        with pytest.raises(InvalidAuthorizationRequest, match="expired"):
            consume_authorization_transaction(session, expired, self.user.id)

        prune_authorization_transactions(session)
        assert session["oa2:ABCD-EFGH"] == {"device_code_id": 123, "user_id": self.user.id}

    def test_account_binding(self) -> None:
        session = self.client.session
        transaction = save_authorization_transaction(session, self.authorization, self.user.id)
        other = self.create_user()
        with pytest.raises(InvalidAuthorizationRequest):
            consume_authorization_transaction(session, transaction, other.id)

        with pytest.raises(InvalidAuthorizationRequest):
            consume_authorization_transaction(session, transaction, self.user.id)

    def test_inactive_application(self) -> None:
        session = self.client.session
        transaction = save_authorization_transaction(session, self.authorization, self.user.id)
        self.application.update(status=ApiApplicationStatus.inactive)
        with pytest.raises(InvalidAuthorizationRequest, match="client_id"):
            consume_authorization_transaction(session, transaction, self.user.id)
