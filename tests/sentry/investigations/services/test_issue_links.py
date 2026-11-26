from __future__ import annotations

from typing import Any

from sentry.constants import ObjectStatus
from sentry.investigations.services.issue_links import link_investigation_issues
from sentry.issues.action_log.types import ActionSource, InvestigationLinkedAction
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.group import Group
from sentry.notebooks.models import NotebookProject, NotebookStatus
from sentry.service_accounts.models import ServiceAccountReplica
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner


@with_feature(
    {
        "organizations:investigations": True,
        "organizations:investigations-issue-links": True,
        "projects:issue-action-log-write-to-db": True,
    }
)
class LinkInvestigationIssuesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        self.investigation = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Checkout latency"
        )
        self.create_notebook_project(self.investigation, self.project)

    def complete(self, linked_issues: list[dict[str, Any]]) -> None:
        with outbox_runner():
            link_investigation_issues(
                investigation_id=self.investigation.id, linked_issues=linked_issues
            )

    def link(self, group: Group, **fields: Any) -> dict[str, Any]:
        return {
            "groupId": group.id,
            "shortId": None,
            "hypothesisId": "h-1",
            "hypothesisStatement": "Payment retries exhaust the pool",
            "reason": "Its timeouts start with the deploy.",
            **fields,
        }

    def entries(self, group: Group | None = None) -> list[GroupActionLogEntry]:
        return list(
            GroupActionLogEntry.objects.filter(
                group_id=(group or self.group).id, type=InvestigationLinkedAction.get_type()
            )
        )

    def test_publishes_a_link_on_the_issue(self) -> None:
        self.complete([self.link(self.group)])

        [entry] = self.entries()
        assert entry.source == ActionSource.SEER_INVESTIGATION
        assert entry.idempotency_key == f"investigation:{self.investigation.id}"
        assert entry.action == InvestigationLinkedAction(
            notebook_id=self.investigation.id,
            hypothesis_id="h-1",
            hypothesis_statement="Payment retries exhaust the pool",
            reason="Its timeouts start with the deploy.",
        )

    def test_links_an_issue_by_short_id_within_the_investigation(self) -> None:
        other_project_group = self.create_group(
            project=self.create_project(organization=self.organization)
        )
        linked = self.create_group(project=self.project)

        self.complete(
            [
                self.link(self.group, groupId=None, shortId=self.group.qualified_short_id),
                self.link(
                    other_project_group,
                    groupId=None,
                    shortId=other_project_group.qualified_short_id,
                ),
                self.link(linked, groupId=None, shortId=f"{self.project.slug}-ZZZZZZ"),
                self.link(linked),
            ]
        )

        assert len(self.entries()) == 1
        assert self.entries(other_project_group) == []
        assert len(self.entries(linked)) == 1

    def test_a_later_run_does_not_link_the_issue_again(self) -> None:
        self.complete([self.link(self.group)])
        self.complete([self.link(self.group, reason="Still relevant.")])

        [entry] = self.entries()
        assert entry.action.dict()["reason"] == "Its timeouts start with the deploy."

    def test_skips_issues_outside_the_investigation(self) -> None:
        other_project = self.create_project(organization=self.organization)
        other_project_group = self.create_group(project=other_project)
        other_org_group = self.create_group(
            project=self.create_project(organization=self.create_organization())
        )

        self.complete([self.link(other_project_group), self.link(other_org_group)])

        assert self.entries(other_project_group) == []
        assert self.entries(other_org_group) == []

    def test_archived_investigation_publishes_nothing(self) -> None:
        self.investigation.status = NotebookStatus.ARCHIVED
        self.investigation.save()

        self.complete([self.link(self.group)])

        assert self.entries() == []

    @with_feature({"organizations:investigations-issue-links": False})
    def test_flag_off_publishes_nothing(self) -> None:
        self.complete([self.link(self.group)])

        assert self.entries() == []

    def test_an_org_wide_investigation_links_any_active_project(self) -> None:
        NotebookProject.objects.filter(notebook=self.investigation).delete()
        other_group = self.create_group(project=self.create_project(organization=self.organization))
        deleted_project_group = self.create_group(
            project=self.create_project(
                organization=self.organization, status=ObjectStatus.PENDING_DELETION
            )
        )

        self.complete([self.link(other_group), self.link(deleted_project_group)])

        assert len(self.entries(other_group)) == 1
        assert self.entries(deleted_project_group) == []

    def test_a_creator_who_left_the_organization_links_nothing(self) -> None:
        self.investigation.update(created_by_id=self.create_user().id)

        self.complete([self.link(self.group)])

        assert self.entries() == []

    def test_an_investigation_without_a_creator_links_nothing(self) -> None:
        self.investigation.update(created_by_id=None)

        self.complete([self.link(self.group)])

        assert self.entries() == []

    @with_feature("organizations:service-accounts")
    def test_a_service_account_links_only_while_it_can_access_the_projects(self) -> None:
        with outbox_runner():
            account = self.create_service_account(
                organization=self.organization, project_ids=[self.project.id]
            )
        self.investigation.update(created_by_id=None, created_by_service_account_id=account.id)
        other_project = self.create_project(organization=self.organization)
        self.create_notebook_project(self.investigation, other_project)

        self.complete([self.link(self.group)])
        assert self.entries() == []

        NotebookProject.objects.filter(project=other_project).delete()
        self.complete([self.link(self.group)])
        assert len(self.entries()) == 1

        ServiceAccountReplica.objects.filter(service_account_id=account.id).update(is_active=False)
        linked = self.create_group(project=self.project)
        self.complete([self.link(linked)])
        assert self.entries(linked) == []
