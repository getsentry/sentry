from __future__ import annotations

from typing import Mapping

from sentry.auth.exceptions import IdentityNotValid
from sentry.models import Identity, Repository
from sentry.shared_integrations.exceptions import ApiError


class CommitContextMixin:
    # whether or not integration has the ability to search through Repositories
    # dynamically given a search query
    repo_search = False

    def get_blame_for_file(
        self, repo: Repository, filepath: str, ref: str, lineno: int
    ) -> str | None:
        """
        Calls the client's `get_blame_for_file` method to see if the file has a blame list.

        repo: Repository (object)
        filepath: filepath of the source code. (string)
        ref: commitsha or default_branch (string)
        """
        filepath = filepath.lstrip("/")
        try:
            client = self.get_client()
        except Identity.DoesNotExist:
            return None
        try:
            response = client.get_blame_for_file(repo, filepath, ref, lineno)
            if response is None:
                return None
        except IdentityNotValid:
            return None
        except ApiError as e:
            raise e

        return response

    def get_commit_context(
        self, repo: Repository, filepath: str, branch: str, event_frame
    ) -> Mapping[str, str] | None:
        """Formats the source code url used for stack trace linking."""
        raise NotImplementedError
