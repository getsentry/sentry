from __future__ import annotations

from typing import Any, TypedDict

from sentry.integrations.services.repository.model import RpcRepository
from sentry.models.repository import Repository


class RepoRename(TypedDict):
    name: str
    url: str
    config: dict[str, Any]


def get_repo_rename(repo: Repository | RpcRepository, *, name: str, url: str) -> RepoRename | None:
    """
    Return the fields to write when the provider reports a different name or URL
    for a repository we already track, or None when the stored values match.

    For providers that keep the full repository name in both ``name`` and
    ``config["name"]``, such as GitHub and GitHub Enterprise.
    """
    if repo.name == name and repo.config.get("name") == name and repo.url == url:
        return None
    return {"name": name, "url": url, "config": {**repo.config, "name": name}}
