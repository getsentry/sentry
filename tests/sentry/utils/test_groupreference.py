from urllib.parse import urlparse

from sentry import options
from sentry.testutils.cases import TestCase
from sentry.utils.groupreference import find_fix_statements


class FindFixStatementsTest(TestCase):
    def _url_prefix(self) -> str:
        return options.get("system.url-prefix")

    def _sentry_host(self) -> str:
        return urlparse(self._url_prefix()).netloc

    def _find(self, text: str | None) -> list[str]:
        return find_fix_statements(text, self.organization.id)

    def test_empty_text(self) -> None:
        assert self._find(None) == []
        assert self._find("") == []

    def test_no_fix_statement(self) -> None:
        group = self.create_group()

        assert self._find(f"Mentions {group.qualified_short_id} without a keyword") == []

    def test_bare_short_id(self) -> None:
        group = self.create_group()

        assert self._find(f"Fixes {group.qualified_short_id}") == [
            f"Fixes {group.qualified_short_id}"
        ]

    def test_markdown_short_id_link(self) -> None:
        group = self.create_group()
        issue_url = group.get_absolute_url(params={"seerDrawer": "true"})
        statement = f"Fixes [{group.qualified_short_id}]({issue_url})"

        assert self._find(statement) == [statement]

    def test_markdown_statement_returned_verbatim_for_removal(self) -> None:
        group = self.create_group()
        issue_url = group.get_absolute_url(params={"seerDrawer": "true"})
        description = (
            f"Some summary paragraph.\n\n"
            f"Fixes [{group.qualified_short_id}]({issue_url})\n\n"
            f"Trailing notes."
        )

        (statement,) = self._find(description)
        assert statement in description
        assert description.replace(statement, "") == (
            "Some summary paragraph.\n\n\n\nTrailing notes."
        )

    def test_whole_line_is_returned(self) -> None:
        group = self.create_group()
        issue_url = group.get_absolute_url()
        line = f"Fixes [{group.qualified_short_id}]({issue_url}) and more prose"

        assert self._find(line) == [line]

    def test_comma_separated_short_ids_are_one_statement(self) -> None:
        group = self.create_group()
        group2 = self.create_group()
        line = f"Fixes {group.qualified_short_id}, {group2.qualified_short_id}"

        assert self._find(line) == [line]

    def test_only_the_matching_line_is_returned(self) -> None:
        group = self.create_group()
        line = f"Fixes {group.qualified_short_id}"
        description = f"Intro paragraph.\n{line}\nOutro paragraph."

        assert self._find(description) == [line]
        assert description.replace(line, "") == "Intro paragraph.\n\nOutro paragraph."

    def test_markdown_link_after_earlier_link(self) -> None:
        group = self.create_group()
        issue_url = group.get_absolute_url()
        statement = f"Fixes [{group.qualified_short_id}]({issue_url})"

        assert self._find(f"See [the docs](https://example.com/docs).\n{statement}") == [statement]

    def test_all_keywords(self) -> None:
        group = self.create_group()
        issue_url = group.get_absolute_url()

        for keyword in ("Fix", "Fixes", "Fixed", "Close", "Closes", "Closed", "Resolves"):
            statement = f"{keyword} [{group.qualified_short_id}]({issue_url})"
            assert self._find(statement) == [statement]

    def test_keyword_with_colon(self) -> None:
        group = self.create_group()

        assert self._find(f"Fixes: {group.qualified_short_id}") == [
            f"Fixes: {group.qualified_short_id}"
        ]

    def test_unknown_short_id_ignored(self) -> None:
        assert self._find("Fixes [NOPE-999](https://example.com/nope)") == []

    def test_short_id_from_other_org_ignored(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_group = self.create_group(project=other_project)
        issue_url = other_group.get_absolute_url()

        assert self._find(f"Fixes [{other_group.qualified_short_id}]({issue_url})") == []

    def test_bare_issue_url(self) -> None:
        group = self.create_group()
        statement = f"Fixes {self._url_prefix()}/issues/{group.id}/"

        assert self._find(statement) == [statement]

    def test_issue_url_wrong_domain_ignored(self) -> None:
        group = self.create_group()

        assert self._find(f"Fixes https://github.com/issues/{group.id}/") == []

    def test_multiple_statements(self) -> None:
        group = self.create_group()
        group2 = self.create_group()
        issue_url = group.get_absolute_url()
        first = f"Fixes [{group.qualified_short_id}]({issue_url})"
        second = f"Fixes {self._url_prefix()}/issues/{group2.id}/"

        assert self._find(f"{first}\n{second}") == [first, second]
