from hashlib import sha1
from urllib.parse import urlparse
from uuid import uuid4

from sentry import options
from sentry.models.commit import Commit
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class FindReferencedGroupsTest(TestCase):
    def _create_commit(self, message: str, org_id: int | None = None) -> Commit:
        """Create a commit with the given message."""
        if org_id is None:
            org_id = self.organization.id
        if not hasattr(self, "_repo"):
            self._repo = Repository.objects.create(
                name="example", organization_id=self.organization.id
            )
        return Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=self._repo.id,
            organization_id=org_id,
            message=message,
        )

    def _url_prefix(self) -> str:
        return options.get("system.url-prefix")

    def _sentry_host(self) -> str:
        return urlparse(self._url_prefix()).netloc

    def test_multiple_matches_basic(self) -> None:
        group = self.create_group()
        group2 = self.create_group()

        for keyword in ["Fixes", "Resolved", "Close"]:
            commit = self._create_commit(
                f"Foo Biz\n\n{keyword} {group.qualified_short_id} {group2.qualified_short_id}"
            )
            groups = commit.find_referenced_groups()
            assert groups == {group, group2}

        # With colon
        commit = self._create_commit(f"Foo Biz\n\nFixes: {group.qualified_short_id}")
        assert commit.find_referenced_groups() == {group}

    def test_multiple_matches_comma_separated(self) -> None:
        group = self.create_group()
        group2 = self.create_group()

        commit = self._create_commit(
            f"Fixes {group.qualified_short_id}, {group2.qualified_short_id}"
        )
        assert commit.find_referenced_groups() == {group, group2}

    def test_markdown_links(self) -> None:
        group = self.create_group()
        group2 = self.create_group()

        commit = self._create_commit(
            f"Fixes [{group.qualified_short_id}](https://sentry.io/), [{group2.qualified_short_id}](https://sentry.io/)"
        )
        assert commit.find_referenced_groups() == {group, group2}

    def test_sentry_issue_url_basic(self) -> None:
        group = self.create_group()

        commit = self._create_commit(f"Fixes {self._url_prefix()}/issues/{group.id}/")
        assert commit.find_referenced_groups() == {group}

    def test_sentry_issue_url_with_query_params(self) -> None:
        group = self.create_group()

        commit = self._create_commit(f"Fixes {self._url_prefix()}/issues/{group.id}?referrer=slack")
        assert commit.find_referenced_groups() == {group}

    def test_sentry_issue_url_organizations_path(self) -> None:
        group = self.create_group()

        commit = self._create_commit(
            f"Fixes {self._url_prefix()}/organizations/myorg/issues/{group.id}/"
        )
        assert commit.find_referenced_groups() == {group}

    def test_sentry_issue_url_multiple(self) -> None:
        group = self.create_group()
        group2 = self.create_group()

        commit = self._create_commit(
            f"Fixes {self._url_prefix()}/issues/{group.id}/\nFixes {self._url_prefix()}/issues/{group2.id}/"
        )
        assert commit.find_referenced_groups() == {group, group2}

    def test_sentry_issue_url_mixed_with_short_id(self) -> None:
        group = self.create_group()
        group2 = self.create_group()

        commit = self._create_commit(
            f"Fixes {group.qualified_short_id}\nFixes {self._url_prefix()}/issues/{group2.id}/"
        )
        assert commit.find_referenced_groups() == {group, group2}

    def test_sentry_issue_url_wrong_domain(self) -> None:
        group = self.create_group()

        commit = self._create_commit(f"Fixes https://github.com/issues/{group.id}/")
        assert commit.find_referenced_groups() == set()

    def test_sentry_issue_url_wrong_org(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_group = self.create_group(project=other_project)

        commit = self._create_commit(f"Fixes {self._url_prefix()}/issues/{other_group.id}/")
        assert commit.find_referenced_groups() == set()

    def test_sentry_issue_url_customer_domain(self) -> None:
        group = self.create_group()

        commit = self._create_commit(f"Fixes http://myorg.{self._sentry_host()}/issues/{group.id}/")
        assert commit.find_referenced_groups() == {group}
