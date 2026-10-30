from __future__ import annotations

import pytest
from django.urls import resolve, reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

ORG = {"organization_id_or_slug": "org-slug"}
NOTEBOOK = {**ORG, "investigation_id": "1"}
BLOCK = {**NOTEBOOK, "block_id": "2"}

PATHS: list[tuple[str, dict[str, str]]] = [
    ("investigations", ORG),
    ("investigation-details", NOTEBOOK),
    ("investigation-blocks", NOTEBOOK),
    ("investigation-block-order", NOTEBOOK),
    ("investigation-block-details", BLOCK),
    ("investigation-block-executions", BLOCK),
    ("investigation-block-execution-details", {**BLOCK, "execution_id": "3"}),
    ("investigation-favorite", NOTEBOOK),
    ("investigation-comments", NOTEBOOK),
    ("investigation-comment-counts", NOTEBOOK),
    ("investigation-comment-details", {**NOTEBOOK, "comment_id": "4"}),
    ("investigation-duplicate", NOTEBOOK),
    ("investigation-action-request-apply", {**NOTEBOOK, "action_request_id": "5"}),
    ("investigation-action-request-recheck", {**NOTEBOOK, "action_request_id": "5"}),
    ("investigation-action-request-retry-follow-up", {**NOTEBOOK, "action_request_id": "5"}),
    ("investigation-presence", NOTEBOOK),
    ("investigation-title-generation", NOTEBOOK),
]


def view_class(path: str) -> type | None:
    return getattr(resolve(path).func, "view_class", None)


def notebook_name(investigation_name: str) -> str:
    if investigation_name == "investigations":
        return "notebooks"
    return investigation_name.replace("investigation-", "notebook-")


@pytest.mark.parametrize(("name", "kwargs"), PATHS)
def test_notebook_path_serves_the_investigation_endpoint(name: str, kwargs: dict[str, str]) -> None:
    old_path = reverse(f"sentry-api-0-organization-{name}", kwargs=kwargs)
    new_path = reverse(f"sentry-api-0-organization-{notebook_name(name)}", kwargs=kwargs)

    assert new_path == old_path.replace("/investigations/", "/notebooks/")
    assert view_class(new_path) is view_class(old_path)
    assert resolve(new_path).kwargs == resolve(old_path).kwargs


@pytest.mark.parametrize(
    ("name", "kwargs"),
    [
        ("investigation-candidates", ORG),
        ("investigation-orchestration", NOTEBOOK),
        ("investigation-orchestration-commands", NOTEBOOK),
    ],
)
def test_seer_only_paths_have_no_notebook_path(name: str, kwargs: dict[str, str]) -> None:
    old_path = reverse(f"sentry-api-0-organization-{name}", kwargs=kwargs)
    new_path = old_path.replace("/investigations/", "/notebooks/")

    assert view_class(new_path) is not view_class(old_path)


@with_feature("organizations:investigations")
class NotebookPathsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.notebook = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Notebook"
        )
        block = self.create_notebook_block(notebook=self.notebook)
        self.create_notebook_comment(notebook=self.notebook, block=block)

    def assert_same_get(self, name: str, **kwargs: str | int) -> None:
        kwargs = {"organization_id_or_slug": self.organization.slug, **kwargs}
        old = self.client.get(reverse(f"sentry-api-0-organization-{name}", kwargs=kwargs))
        new = self.client.get(
            reverse(f"sentry-api-0-organization-{notebook_name(name)}", kwargs=kwargs)
        )

        assert old.status_code == 200
        assert new.status_code == old.status_code
        assert new.data == old.data

    def test_list(self) -> None:
        self.assert_same_get("investigations")

    def test_details(self) -> None:
        self.assert_same_get("investigation-details", investigation_id=self.notebook.id)

    def test_comments(self) -> None:
        self.assert_same_get("investigation-comments", investigation_id=self.notebook.id)

    def test_comment_counts(self) -> None:
        self.assert_same_get("investigation-comment-counts", investigation_id=self.notebook.id)

    def test_title_generation(self) -> None:
        self.assert_same_get("investigation-title-generation", investigation_id=self.notebook.id)

    def test_candidates_is_not_a_notebook_id(self) -> None:
        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/notebooks/candidates/"
        )

        assert response.status_code == 404
