from datetime import datetime, timezone
from hashlib import sha1
from urllib.parse import urlparse
from uuid import uuid4

from sentry import options
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.commits import materialize_commit
from sentry.models.repository import Repository
from sentry.plugins.providers.integration_repository import CommitData
from sentry.testutils.cases import TestCase


class FindReferencedGroupsTest(TestCase):
    def _create_commit(self, message: str) -> Commit:
        """Create a commit with the given message."""
        if not hasattr(self, "_repo"):
            self._repo = Repository.objects.create(
                name="example", organization_id=self.organization.id
            )
        return Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=self._repo.id,
            organization_id=self.organization.id,
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

    def test_sentry_issue_url_ignores_query_param_issues(self) -> None:
        """Ensure /issues/{id} in query params doesn't match"""
        group = self.create_group()

        # URL with /issues/ID only in query param, not in path
        commit = self._create_commit(
            f"Fixes {self._url_prefix()}/settings?redirect=/issues/{group.id}"
        )
        assert commit.find_referenced_groups() == set()

    def test_sentry_issue_url_overflow_id(self) -> None:
        """Ensure extremely large IDs don't crash"""
        self.create_group()

        commit = self._create_commit(
            f"Fixes {self._url_prefix()}/issues/999999999999999999999999999/"
        )
        assert commit.find_referenced_groups() == set()


class MaterializeCommitTest(TestCase):
    def test_materializes_and_deduplicates_canonical_data(self) -> None:
        repo = self.create_repo(project=self.project, name="example/repo")
        author = self.create_commit_author(
            project=self.project,
            email="author@example.com",
        )
        author.update(name="Example Author")
        timestamp = datetime(2020, 1, 2, 3, 4, tzinfo=timezone.utc)
        data: CommitData = {
            "id": "a" * 40,
            "repository": repo.name,
            "author_email": author.email,
            "author_name": "Example Author",
            "message": "Subject\n\nFixes TEST-1",
            "timestamp": timestamp,
            "patch_set": [
                {"path": "src/example.py", "type": "M"},
                {"path": "src/example.py", "type": "A"},
            ],
        }

        first = materialize_commit(
            organization_id=self.organization.id,
            repository=repo,
            author=author,
            data=data,
        )
        second = materialize_commit(
            organization_id=self.organization.id,
            repository=repo,
            author=author,
            data=data,
        )

        assert first.created
        assert not second.created
        assert first.commit.id == second.commit.id
        assert first.commit.message == data["message"]
        assert first.commit.author == author
        assert first.commit.date_added == timestamp
        assert [(change.filename, change.type) for change in first.file_changes] == [
            ("src/example.py", "M")
        ]
        assert second.file_changes == []
        assert list(
            CommitFileChange.objects.filter(commit_id=first.commit.id).values_list(
                "filename", "type"
            )
        ) == [("src/example.py", "M")]

    def test_reference_does_not_clear_hydrated_metadata(self) -> None:
        repo = self.create_repo(project=self.project, name="example/repo")
        author = self.create_commit_author(project=self.project, email="author@example.com")
        data: CommitData = {
            "id": "b" * 40,
            "repository": repo.name,
            "author_email": author.email,
            "author_name": "Author",
            "message": "Complete message",
            "timestamp": datetime(2020, 1, 2, 3, 4, tzinfo=timezone.utc),
            "patch_set": [],
        }
        materialized = materialize_commit(
            organization_id=self.organization.id,
            repository=repo,
            author=author,
            data=data,
        )
        reference = {"id": data["id"], "repository": repo.name}

        materialize_commit(
            organization_id=self.organization.id,
            repository=repo,
            author=None,
            data=reference,
        )

        materialized.commit.refresh_from_db()
        assert materialized.commit.message == data["message"]
        assert materialized.commit.author == author
        assert materialized.commit.date_added == data["timestamp"]
