"""
GitLab service provider module.

Unsupported actions:

    * create_check_run
    * create_git_blob
    * create_git_commit
    * create_git_tree
    * create_pull_request_draft
    * create_review
    * get_check_run
    * get_git_commit
    * get_pull_request_diff
    * get_tree
    * minimize_comment
    * request_review
    * resolve_review_thread
    * update_branch
    * update_check_run
"""

import datetime
import functools
from collections.abc import Callable
from typing import Any, Iterable
from urllib.parse import urlencode

from sentry.integrations.gitlab.client import GitLabApiClient
from sentry.integrations.gitlab.utils import GitLabApiClientPath
from sentry.scm.errors import SCMProviderException
from sentry.scm.types import (
    SHA,
    ActionResult,
    ArchiveFormat,
    ArchiveLink,
    Author,
    BranchName,
    Comment,
    Commit,
    CommitAuthor,
    FileContent,
    GitRef,
    PaginatedActionResult,
    PaginatedResponseMeta,
    PaginationParams,
    PullRequest,
    PullRequestBranch,
    PullRequestCommit,
    PullRequestFile,
    PullRequestState,
    Reaction,
    ReactionResult,
    Referrer,
    Repository,
    RequestOptions,
    ReviewComment,
    ReviewSide,
)
from sentry.shared_integrations.exceptions import ApiError

AWARD_NAME_BY_REACTION: dict[Reaction, str] = {
    "+1": "thumbsup",
    "-1": "thumbsdown",
    "laugh": "laughing",
    "confused": "confused",
    "heart": "heart",
    "hooray": "tada",
    "rocket": "rocket",
    "eyes": "eyes",
}

REACTION_BY_AWARD_NAME: dict[str, Reaction] = {
    award: reaction for reaction, award in AWARD_NAME_BY_REACTION.items()
}

GITLAB_ARCHIVE_FORMAT_MAP: dict[ArchiveFormat, str] = {
    "tarball": ".tar.gz",
    "zip": ".zip",
}

PULL_REQUEST_STATE_RETRIEVE_MAP: dict[PullRequestState, list[str]] = {
    "open": ["opened"],
    "closed": ["closed", "merged"],
}
PULL_REQUEST_STATE_UPDATE_MAP: dict[PullRequestState, str] = {"open": "reopen", "closed": "close"}


def catch_provider_exception(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    return wrapper


class GitLabProvider:
    def __init__(
        self, client: GitLabApiClient, organization_id: int, repository: Repository
    ) -> None:
        self.client = client
        self.organization_id = organization_id
        self.repository = repository
        external_id = repository["external_id"]
        assert external_id is not None
        prefix = "gitlab.com:"
        assert external_id.startswith(prefix)
        self._repo_id = external_id[len(prefix) :]

    def is_rate_limited(self, referrer: Referrer) -> bool:
        return False  # Rate-limits temporarily disabled.

    @catch_provider_exception
    def get_issue_comments(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        raw = self.client.get_issue_notes(self._repo_id, issue_id)
        return make_paginated_result(map_comment, raw)

    @catch_provider_exception
    def create_issue_comment(self, issue_id: str, body: str) -> ActionResult[Comment]:
        raw = self.client.create_comment(self._repo_id, issue_id, {"body": body})
        return make_result(map_comment, raw)

    @catch_provider_exception
    def delete_issue_comment(self, issue_id: str, comment_id: str) -> None:
        self.client.delete_issue_note(self._repo_id, issue_id, comment_id)

    @catch_provider_exception
    def get_pull_request(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[PullRequest]:
        raw = self.client.get_merge_request(self._repo_id, pull_request_id)
        return make_result(map_pull_request, raw)

    @catch_provider_exception
    def get_pull_request_comments(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        """
        To achieve a behavior consistent with GitHub, we filter out:

        1) GitLab's "system notes"
        They are auto-generated comments for events like "Someone resolved all threads".
        They don't exist on GitHub and have little use outside GitLab's UI.

        2) GitLab's review comments
        They correspond to GitHub's review comments, which are not returned by GitHub's
        "list review comments" endpoint, used to to implement `get_pull_request_comments`.
        """

        raw = self.client.get_merge_request_notes(self._repo_id, pull_request_id)
        return make_paginated_result(
            map_comment,
            raw,
            raw_items=(
                note
                for note in raw
                if (
                    not note["system"]  # Filter out system notes
                    and note.get("position") is None  # Filter out review comments
                )
            ),
        )

    @catch_provider_exception
    def create_pull_request_comment(self, pull_request_id: str, body: str) -> ActionResult[Comment]:
        raw = self.client.create_merge_request_note(self._repo_id, pull_request_id, {"body": body})
        return make_result(map_comment, raw)

    @catch_provider_exception
    def delete_pull_request_comment(self, pull_request_id: str, comment_id: str) -> None:
        self.client.delete_merge_request_note(self._repo_id, pull_request_id, comment_id)

    @catch_provider_exception
    def get_issue_comment_reactions(
        self,
        issue_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        raw = self.client.get_issue_note_awards(self._repo_id, issue_id, comment_id)
        return make_paginated_result(
            map_reaction_result,
            raw,
            raw_items=(award for award in raw if award["name"] in REACTION_BY_AWARD_NAME),
        )

    @catch_provider_exception
    def create_issue_comment_reaction(
        self,
        issue_id: str,
        comment_id: str,
        reaction: Reaction,
    ) -> ActionResult[ReactionResult]:
        raw = self.client.create_issue_note_award(
            self._repo_id,
            issue_id,
            comment_id,
            AWARD_NAME_BY_REACTION[reaction],
        )
        return make_result(map_reaction_result, raw)

    @catch_provider_exception
    def delete_issue_comment_reaction(
        self,
        issue_id: str,
        comment_id: str,
        reaction_id: str,
    ) -> None:
        self.client.delete_issue_note_award(self._repo_id, issue_id, comment_id, reaction_id)

    @catch_provider_exception
    def get_pull_request_comment_reactions(
        self,
        pull_request_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        raw = self.client.get_merge_request_note_awards(self._repo_id, pull_request_id, comment_id)
        return make_paginated_result(
            map_reaction_result,
            raw,
            raw_items=(award for award in raw if award["name"] in REACTION_BY_AWARD_NAME),
        )

    @catch_provider_exception
    def create_pull_request_comment_reaction(
        self,
        pull_request_id: str,
        comment_id: str,
        reaction: Reaction,
    ) -> ActionResult[ReactionResult]:
        raw = self.client.create_merge_request_note_award(
            self._repo_id, pull_request_id, comment_id, AWARD_NAME_BY_REACTION[reaction]
        )
        return make_result(map_reaction_result, raw)

    @catch_provider_exception
    def delete_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction_id: str
    ) -> None:
        self.client.delete_merge_request_note_award(
            self._repo_id,
            pull_request_id,
            comment_id,
            reaction_id,
        )

    @catch_provider_exception
    def get_issue_reactions(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        raw = self.client.get_issue_awards(self._repo_id, issue_id)
        return make_paginated_result(
            map_reaction_result,
            raw,
            raw_items=(award for award in raw if award["name"] in REACTION_BY_AWARD_NAME),
        )

    @catch_provider_exception
    def create_issue_reaction(
        self, issue_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        raw = self.client.create_issue_award(
            self._repo_id,
            issue_id,
            AWARD_NAME_BY_REACTION[reaction],
        )
        return make_result(map_reaction_result, raw)

    @catch_provider_exception
    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None:
        self.client.delete_issue_award(self._repo_id, issue_id, reaction_id)

    @catch_provider_exception
    def get_pull_request_reactions(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        raw = self.client.get_merge_request_awards(self._repo_id, pull_request_id)
        return make_paginated_result(
            map_reaction_result,
            raw,
            raw_items=(award for award in raw if award["name"] in REACTION_BY_AWARD_NAME),
        )

    @catch_provider_exception
    def create_pull_request_reaction(
        self, pull_request_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        raw = self.client.create_merge_request_award(
            self._repo_id, pull_request_id, AWARD_NAME_BY_REACTION[reaction]
        )
        return make_result(map_reaction_result, raw)

    @catch_provider_exception
    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None:
        self.client.delete_merge_request_award(self._repo_id, pull_request_id, reaction_id)

    @catch_provider_exception
    def get_branch(
        self,
        branch: BranchName,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitRef]:
        raw = self.client.get_branch(self._repo_id, branch)
        return make_result(map_git_ref, raw)

    @catch_provider_exception
    def create_branch(self, branch: BranchName, sha: SHA) -> ActionResult[GitRef]:
        raw = self.client.create_branch(self._repo_id, branch, sha)
        return make_result(map_git_ref, raw)

    @catch_provider_exception
    def get_archive_link(
        self,
        ref: str,
        archive_format: ArchiveFormat = "tarball",
    ) -> ActionResult[ArchiveLink]:
        fmt = GITLAB_ARCHIVE_FORMAT_MAP[archive_format]
        path = GitLabApiClientPath.archive.format(project=self._repo_id, format=fmt)
        url = GitLabApiClientPath.build_api_url(self.client.base_url, path)
        if ref:
            url = f"{url}?{urlencode({'sha': ref})}"
        token_data = self.client.get_access_token()
        token = token_data["access_token"] if token_data else None
        data = ArchiveLink(url=url, headers={"Authorization": f"Bearer {token}"} if token else {})
        return ActionResult(
            data=data,
            type="gitlab",
            raw=url,
            meta={},
        )

    @catch_provider_exception
    def get_file_content(
        self,
        path: str,
        ref: str | None = None,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[FileContent]:
        raw = self.client.get_file_content(self._repo_id, path, ref)
        return make_result(map_file_content, raw)

    @catch_provider_exception
    def get_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[Commit]:
        raw = self.client.get_commit(self._repo_id, sha)
        return make_result(map_commit, raw)

    @catch_provider_exception
    def get_commits(
        self,
        ref: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        raw = self.client.get_commits(self._repo_id, ref=ref, path=None)
        return make_paginated_result(map_commit, raw)

    @catch_provider_exception
    def get_commits_by_path(
        self,
        path: str,
        ref: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        raw = self.client.get_commits(self._repo_id, ref=ref, path=path)
        return make_paginated_result(map_commit, raw)

    @catch_provider_exception
    def compare_commits(
        self,
        start_sha: SHA,
        end_sha: SHA,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        raw = self.client.compare_commits(self._repo_id, start_sha, end_sha)
        return make_paginated_result(map_commit, raw, raw_items=raw["commits"])

    @catch_provider_exception
    def get_pull_request_files(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestFile]:
        raw = self.client.get_merge_request_diffs(self._repo_id, pull_request_id)
        return make_paginated_result(map_pull_request_file, raw)

    @catch_provider_exception
    def get_pull_request_commits(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestCommit]:
        raw = self.client.get_merge_request_commits(self._repo_id, pull_request_id)
        return make_paginated_result(map_pull_request_commit, raw, raw_items=reversed(raw))

    @catch_provider_exception
    def get_pull_requests(
        self,
        state: PullRequestState | None = "open",
        # @todo The 'head' parameter has very ad-hoc behavior on GitHub; we should consider removing it entirely.
        head: BranchName | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequest]:
        raw = []
        gitlab_states: list[str] | list[None]
        if state:
            gitlab_states = PULL_REQUEST_STATE_RETRIEVE_MAP[state]
        else:
            gitlab_states = [None]
        for gitlab_state in gitlab_states:
            raw.extend(self.client.get_merge_requests(self._repo_id, state=gitlab_state))
        return make_paginated_result(map_pull_request, raw)

    @catch_provider_exception
    def create_pull_request(
        self,
        title: str,
        body: str,
        head: str,
        base: str,
    ) -> ActionResult[PullRequest]:
        data = {
            "title": title,
            "description": body,
            "source_branch": head,
            "target_branch": base,
        }
        raw = self.client.create_merge_request(self._repo_id, data)
        return make_result(map_pull_request, raw)

    @catch_provider_exception
    def update_pull_request(
        self,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: PullRequestState | None = None,
    ) -> ActionResult[PullRequest]:
        data = {}
        if title is not None:
            data["title"] = title
        if body is not None:
            data["description"] = body
        if state is not None:
            data["state_event"] = PULL_REQUEST_STATE_UPDATE_MAP[state]
        raw = self.client.update_merge_request(self._repo_id, pull_request_id, data)
        return make_result(map_pull_request, raw)

    @catch_provider_exception
    def create_review_comment_file(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]:
        """
        GitLab's "notes" are similar to GitHub's "comments".
        Additionally, each note belongs to a "discussion".

        On GitLab, one replies to a discussion. On GitHub, one replies to a comment.

        To allow replying to review comments in a consistent way across providers,
        we build a comment ID made of the GitLab's discussion ID and comment ID.
        It can be passed to `create_review_comment_reply`, and uniquely identifies a note.
        """

        versions = self.client.get_merge_request_versions(self._repo_id, pull_request_id)
        raw = self.client.create_merge_request_discussion(
            self._repo_id,
            pull_request_id,
            {
                "body": body,
                "position": {
                    "position_type": "file",
                    "base_sha": versions[0]["base_commit_sha"],
                    "head_sha": versions[0]["head_commit_sha"],
                    "start_sha": versions[0]["start_commit_sha"],
                    "new_path": path,
                    "old_path": path,
                },
            },
        )
        return make_result(
            map_review_comment(raw["id"]),
            raw,
            raw_item=raw["notes"][0],
        )

    @catch_provider_exception
    def create_review_comment_reply(
        self,
        pull_request_id: str,
        body: str,
        comment_id: str,
    ) -> ActionResult[ReviewComment]:
        """
        The comment_id must have the format returned by `create_review_comment_file`.
        The newly created comment's ID will have the same format.
        """
        discussion_id = comment_id.split(":")[0]
        raw = self.client.create_merge_request_discussion_note(
            self._repo_id,
            pull_request_id,
            discussion_id,
            {"body": body},
        )
        return make_result(
            map_review_comment(discussion_id),
            raw,
        )


def make_paginated_result[T](
    map_item: Callable[[dict[str, Any]], T],
    raw: Any,
    *,
    raw_items: Iterable[dict[str, Any]] | None = None,
) -> PaginatedActionResult[T]:
    if raw_items is None:
        assert isinstance(raw, list)
        raw_items = raw
    return PaginatedActionResult(
        data=[map_item(item) for item in raw_items],
        type="gitlab",
        raw=raw,
        # No actual pagination for now
        meta=PaginatedResponseMeta(next_cursor=None),
    )


def make_result[T](
    map_item: Callable[[dict[str, Any]], T],
    raw: Any,
    *,
    raw_item: dict[str, Any] | None = None,
) -> ActionResult[T]:
    if raw_item is None:
        assert isinstance(raw, dict)
        raw_item = raw
    return ActionResult(
        data=map_item(raw_item),
        type="gitlab",
        raw=raw,
        meta={},
    )


def map_author(raw: dict[str, Any]) -> Author:
    return Author(
        id=str(raw["id"]),
        username=raw["username"],
    )


def map_comment(raw: dict[str, Any]) -> Comment:
    return Comment(
        id=str(raw["id"]),
        body=raw["body"],
        author=map_author(raw["author"]),
    )


def map_commit(raw: dict[str, Any]) -> Commit:
    return Commit(
        id=str(raw["id"]),
        message=raw["message"],
        author=CommitAuthor(
            name=raw["author_name"],
            email=raw["author_email"],
            date=datetime.datetime.fromisoformat(raw["created_at"]),
        ),
        files=None,
    )


def map_file_content(raw: dict[str, Any]) -> FileContent:
    return FileContent(
        path=raw["file_path"],
        sha=raw["blob_id"],
        content=raw["content"],
        encoding=raw["encoding"],
        size=raw["size"],
    )


def map_git_ref(raw: dict[str, Any]) -> GitRef:
    return GitRef(ref=raw["name"], sha=raw["commit"]["id"])


def map_pull_request(raw: dict[str, Any]) -> PullRequest:
    return PullRequest(
        id=str(raw["id"]),
        number=str(raw["iid"]),
        title=raw["title"],
        body=raw["description"] or None,
        state="open" if raw["state"] == "opened" else "closed",
        base=PullRequestBranch(ref=raw["target_branch"], sha=None),
        head=PullRequestBranch(
            ref=raw["source_branch"],
            sha=raw["sha"],
        ),
        merged=raw["merged_at"] is not None,
        html_url=raw["web_url"],
    )


def map_pull_request_commit(raw: dict[str, Any]) -> PullRequestCommit:
    return PullRequestCommit(
        sha=raw["id"],
        message=raw["message"],
        author=CommitAuthor(
            name=raw["author_name"],
            email=raw["author_email"],
            date=datetime.datetime.fromisoformat(raw["authored_date"]),
        ),
    )


def map_pull_request_file(raw: dict[str, Any]) -> PullRequestFile:
    return PullRequestFile(
        filename=raw["new_path"],
        previous_filename=(raw["old_path"] if raw["old_path"] != raw["new_path"] else None),
        status=("added" if raw["new_file"] else "removed" if raw["deleted_file"] else "modified"),
        changes=0,
        patch=raw.get("diff"),
        sha="",
    )


def map_reaction_result(raw: dict[str, Any]) -> ReactionResult:
    return ReactionResult(
        id=str(raw["id"]),
        content=REACTION_BY_AWARD_NAME[raw["name"]],
        author=map_author(raw["user"]),
    )


def map_review_comment(discussion_id: str) -> Callable[[dict[str, Any]], ReviewComment]:
    def _map_review_comment(raw: dict[str, Any]) -> ReviewComment:
        return ReviewComment(
            id=f"{discussion_id}:{raw['id']}",
            html_url=None,
            path=raw["position"]["new_path"],
            body=raw["body"],
        )

    return _map_review_comment
