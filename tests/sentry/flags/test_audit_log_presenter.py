from django.urls import reverse

from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP, FlagAuditLogModel
from sentry.runner.commands.presenters.audit_log_presenter import AuditLogPresenter, AuditLogRequest
from sentry.testutils.cases import APITestCase
from sentry.utils.security.orgauthtoken_token import hash_token


def test_audit_log_item_generation():
    presenter = AuditLogPresenter("", None)
    presenter.set("a", True)
    presenter.unset("b")
    presenter.update("c", True, False)
    presenter.drift("d", False)

    items = presenter._create_audit_log_items()
    assert len(items) == 4

    assert items[0]["action"] == "created"
    assert items[0]["flag"] == "a"
    assert items[0]["tags"] == {"value": True}

    assert items[1]["action"] == "deleted"
    assert items[1]["flag"] == "b"
    assert items[1]["tags"] == {}

    assert items[2]["action"] == "updated"
    assert items[2]["flag"] == "c"
    assert items[2]["tags"] == {"value": False}

    assert items[3]["action"] == "updated"
    assert items[3]["flag"] == "d"
    assert items[3]["tags"] == {}


class AuditLogPresenterFunctionalTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-hooks"

    def setUp(self):
        super().setUp()
        self.url = reverse(self.endpoint, args=(self.organization.slug, "flag-pole"))

    def test_post(self):
        def mock_request(request: AuditLogRequest):
            self.client.post(
                request["url"],
                data={"data": request["data"]},
                headers=request["headers"],
            )

        token = "sntrys_abc123_xyz"
        self.create_org_auth_token(
            name="Test Token 1",
            token_hashed=hash_token(token),
            organization_id=self.organization.id,
            token_last_characters="xyz",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        with self.options(
            {
                "flags:options-audit-log-webhook-url": self.url,
                "flags:options-audit-log-token": token,
                "flags:options-audit-log-is-disabled": False,
            }
        ):
            presenter = AuditLogPresenter("", request_fn=mock_request)
            presenter.set("a", True)
            presenter.flush()

        assert FlagAuditLogModel.objects.count() == 1
        flag = FlagAuditLogModel.objects.first()
        assert flag is not None
        assert flag.action == ACTION_MAP["created"]
        assert flag.flag == "a"
        assert flag.created_by == "internal"
        assert flag.created_by_type == CREATED_BY_TYPE_MAP["email"]
        assert flag.organization_id == self.organization.id
        assert flag.tags == {"value": True}
