from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP, FlagAuditLogModel
from sentry.runner.commands.presenters.audit_log_presenter import AuditLogPresenter
from sentry.testutils.cases import APITestCase


def test_audit_log_item_generation():
    presenter = AuditLogPresenter("", True)
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
    endpoint = "sentry-api-0-flag-hooks"

    def test_audit_log_presenter_flush(self):
        with self.options(
            {
                "flags:options-audit-log-is-enabled": True,
                "flags:options-audit-log-organization-id": self.organization.id,
            }
        ):
            presenter = AuditLogPresenter("", dry_run=False)
            presenter.set("a", True)
            presenter.flush()

        assert FlagAuditLogModel.objects.count() == 1
        flag = FlagAuditLogModel.objects.first()
        assert flag is not None
        assert flag.action == ACTION_MAP["created"]
        assert flag.flag == "a"
        assert flag.created_by == "internal"
        assert flag.created_by_type == CREATED_BY_TYPE_MAP["name"]
        assert flag.organization_id == self.organization.id
        assert flag.tags == {"value": True}

    def test_audit_log_presenter_flush_dry_run(self):
        with self.options(
            {
                "flags:options-audit-log-is-enabled": True,
                "flags:options-audit-log-organization-id": self.organization.id,
            }
        ):
            presenter = AuditLogPresenter("", dry_run=True)
            presenter.set("a", True)
            presenter.flush()

        assert FlagAuditLogModel.objects.count() == 0
