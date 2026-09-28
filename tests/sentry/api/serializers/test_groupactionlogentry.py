from typing import Any
from unittest.mock import patch

from sentry.api.serializers import serialize
from sentry.api.serializers.models.groupactionlogentry import get_serialized_activity_items
from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.commit import Commit
from sentry.models.group import GroupStatus
from sentry.models.pullrequest import PullRequest
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.action_log import action_log_activity_enabled
from sentry.testutils.silo import assume_test_silo_mode


class GroupActionLogEntrySerializerTestCase(TestCase):
    def test_trigger_autofix_entry_type(self) -> None:
        user = self.create_user()
        group = self.create_group()
        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.TRIGGER_AUTOFIX,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"referrer": "slack"},
        )

        result = serialize(entry, user)

        assert result["type"] == "trigger_autofix"
        assert result["id"] == str(entry.id)
        assert result["commentId"] is None
        assert result["data"] == {"referrer": "slack"}

    def test_pull_request_entry(self) -> None:
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")
        pr = PullRequest.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key=5,
            title="aaaa",
            message="kartoffel",
        )

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.RESOLVED_IN_PULL_REQUEST,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"pull_request": pr.id},
        )

        result = serialize([entry], user)[0]["data"]
        pull_request = result["pullRequest"]
        assert pull_request["repository"]["name"] == "organization-bar"
        assert pull_request["message"] == "kartoffel"

    def test_pull_request_closed_entry(self) -> None:
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")
        pr = PullRequest.objects.create(
            organization_id=self.org.id,
            repository_id=repo.id,
            key=5,
            title="aaaa",
            message="kartoffel",
        )

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.PULL_REQUEST_CLOSED,
            data={"pull_request": pr.id},
        )

        result = serialize([entry], user)[0]
        assert result["type"] == "pull_request_closed"
        pull_request = result["data"]["pullRequest"]
        assert pull_request["repository"]["name"] == "organization-bar"
        assert pull_request["message"] == "kartoffel"

    def test_commit_entry(self) -> None:
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")

        commit = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key="11111111", message="gemuse"
        )

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.SET_RESOLVED_IN_COMMIT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"commit": commit.id},
        )

        result = serialize([entry], user)[0]["data"]
        commit_data = result["commit"]
        assert commit_data["repository"]["name"] == "organization-bar"
        assert commit_data["message"] == "gemuse"

    def test_referenced_in_commit_entry(self) -> None:
        self.org = self.create_organization(name="Rowdy Tiger")
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        repo = self.create_repo(self.project, name="organization-bar")

        commit = Commit.objects.create(
            organization_id=self.org.id, repository_id=repo.id, key="11111111", message="gemuse"
        )

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.REFERENCED_IN_COMMIT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"commit": commit.id},
        )

        result = serialize([entry], user)[0]
        assert result["type"] == "referenced_in_commit"
        commit_data = result["data"]["commit"]
        assert commit_data["repository"]["name"] == "organization-bar"
        assert commit_data["message"] == "gemuse"

    def test_serialize_set_resolve_in_commit_entry_with_release(self) -> None:
        project = self.create_project(name="test_throwaway")
        group = self.create_group(project)
        user = self.create_user()
        release = self.create_release(project=project, user=user)
        release.save()
        commit = Commit.objects.filter(releasecommit__release_id=release.id).get()

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.SET_RESOLVED_IN_COMMIT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"commit": commit.id},
        )

        serialized = serialize(entry)

        assert len(serialized["data"]["commit"]["releases"]) == 1

    def test_serialize_set_resolve_in_commit_entry_with_no_releases(self) -> None:
        self.org = self.create_organization(name="komal-test")
        project = self.create_project(name="random-proj")
        user = self.create_user()
        repo = self.create_repo(self.project, name="idk-repo")
        group = self.create_group(project)

        commit = Commit.objects.create(organization_id=self.org.id, repository_id=repo.id)

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.SET_RESOLVED_IN_COMMIT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"commit": commit.id},
        )

        serialized = serialize(entry)

        assert len(serialized["data"]["commit"]["releases"]) == 0
        assert not Commit.objects.filter(releasecommit__id=commit.id).exists()

    def test_serialize_set_resolve_in_commit_entry_with_release_not_deployed(self) -> None:
        project = self.create_project(name="random-test")
        group = self.create_group(project)
        user = self.create_user()
        release = self.create_release(project=project, user=user)
        release.date_released = None
        release.save()
        commit = Commit.objects.filter(releasecommit__release_id=release.id).get()

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.SET_RESOLVED_IN_COMMIT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"commit": commit.id},
        )

        serialized = serialize(entry)

        assert len(serialized["data"]["commit"]["releases"]) == 1

    def test_sentry_app_entry(self) -> None:
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        # regular user with no sentry_app
        user_entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.RESOLVE,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
        )
        assert serialize(user_entry, user)["sentry_app"] is None

        sentry_app = self.create_sentry_app(name="test_sentry_app")
        default_avatar = self.create_sentry_app_avatar(sentry_app=sentry_app)
        upload_avatar = self.create_sentry_app_avatar(sentry_app=sentry_app)
        with assume_test_silo_mode(SiloMode.CONTROL):
            upload_avatar.avatar_type = 1  # an upload
            upload_avatar.color = True  # a logo
            upload_avatar.save()

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.RESOLVE,
            actor_type=GroupActorType.SENTRY_APP,
            actor_id=sentry_app.id,
        )

        result = serialize(entry, user)
        assert result["sentry_app"]["id"] == str(sentry_app.id)
        assert result["sentry_app"]["name"] == sentry_app.name
        assert result["sentry_app"]["slug"] == sentry_app.slug
        assert {
            "avatarType": "default",
            "avatarUuid": default_avatar.ident,
            "avatarUrl": f"http://testserver/sentry-app-avatar/{default_avatar.ident}/",
            "color": False,
            "photoType": "icon",
        } in result["sentry_app"]["avatars"]
        assert {
            "avatarType": "upload",
            "avatarUuid": upload_avatar.ident,
            "avatarUrl": f"http://testserver/sentry-app-avatar/{upload_avatar.ident}/",
            "color": True,
            "photoType": "logo",
        } in result["sentry_app"]["avatars"]

    def test_archive_entry_translates_keys(self) -> None:
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.ARCHIVE,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"ignore_count": 5, "ignore_until_escalating": True},
        )

        result = serialize(entry, user)
        assert result["data"] == {"ignoreCount": 5, "ignoreUntilEscalating": True}

    def test_assign_entry_translates_keys(self) -> None:
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.ASSIGN,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={
                "assignee": "1",
                "assignee_email": "user@example.com",
                "assignee_type": "user",
                "rule": "codeowners",
            },
        )

        result = serialize(entry, user)
        assert result["data"] == {
            "assignee": "1",
            "assigneeEmail": "user@example.com",
            "assigneeType": "user",
            "rule": "codeowners",
        }

    def test_set_resolved_by_age_entry_translates_keys(self) -> None:
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.SET_RESOLVED_BY_AGE,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"auto_resolve_age_threshold": 720},
        )

        result = serialize(entry, user)
        assert result["data"] == {"age": 720}

    def test_reprocess_entry_translates_keys(self) -> None:
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.REPROCESS,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"event_count": 3, "old_group_id": 10, "new_group_id": 11},
        )

        result = serialize(entry, user)
        assert result["data"] == {"eventCount": 3, "oldGroupId": 10, "newGroupId": 11}

    def test_merge_entry_reshapes_issues(self) -> None:
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        entry = self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.MERGE_FROM_OTHER,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"counterpart_group_ids": [2, 3]},
        )

        result = serialize(entry, user)
        assert result["data"] == {"issues": [{"id": "2"}, {"id": "3"}]}

    def test_comment_entry_serializes_its_own_id_and_comment_reference(self) -> None:
        user = self.create_user()
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        entry = self.create_group_action_log_entry(
            id=456,
            group=group,
            type=GroupActionType.COMMENT,
            actor_type=GroupActorType.USER,
            actor_id=user.id,
            data={"comment_id": 123, "text": "hello world"},
        )

        result = serialize(entry, user)
        assert result["id"] == "456"
        assert result["commentId"] == "123"
        assert result["type"] == "note"

    def test_comment_mutations_keep_their_own_ids_without_comment_references(self) -> None:
        comment = self._comment(123, "original")
        edit = self._comment_mutation(GroupActionType.COMMENT_EDIT, comment, text="edited")
        delete = self._comment_mutation(GroupActionType.COMMENT_DELETE, comment)

        results = serialize([edit, delete], self.user)
        assert [result["id"] for result in results] == [str(edit.id), str(delete.id)]
        assert [result["commentId"] for result in results] == [None, None]

    def _comment(self, comment_id: int, text: str) -> GroupActionLogEntry:
        return self.create_group_action_log_entry(
            type=GroupActionType.COMMENT,
            actor_type=GroupActorType.USER,
            actor_id=self.user.id,
            data={"comment_id": comment_id, "text": text},
        )

    def _comment_mutation(
        self, type: GroupActionType, comment: GroupActionLogEntry, **data: object
    ) -> GroupActionLogEntry:
        return self.create_group_action_log_entry(
            type=type,
            actor_type=GroupActorType.USER,
            actor_id=self.user.id,
            data={"comment_id": comment.id, **data},
        )

    def _activity_items(self, limit: int = 99) -> list[dict[str, Any]]:
        with action_log_activity_enabled():
            items = get_serialized_activity_items(
                self.group, self.user, endpoint="test", limit=limit
            )
        assert items is not None
        return items

    def test_comment_edit_replaces_the_comment_text(self) -> None:
        comment = self._comment(123, "original")
        self._comment_mutation(GroupActionType.COMMENT_EDIT, comment, text="edited")

        items = self._activity_items()

        assert [item["type"] for item in items] == ["note", "first_seen"]
        assert items[0]["id"] == str(comment.id)
        assert items[0]["commentId"] == "123"
        assert items[0]["data"]["text"] == "edited"
        assert items[1]["id"] == "0"
        assert items[1]["commentId"] is None

    def test_edit_at_window_boundary_preserves_comment(self) -> None:
        comment = self._comment(123, "original")
        older_action = self.create_group_action_log_entry(type=GroupActionType.RESOLVE)
        newer_action = self.create_group_action_log_entry(type=GroupActionType.UNRESOLVE)
        before = self._activity_items(limit=3)

        for edit_number in range(16):
            self._comment_mutation(
                GroupActionType.COMMENT_EDIT, comment, text=f"edit {edit_number}"
            )

        with patch.object(
            GroupActionLogEntry.objects,
            "get_actions_for_group",
            wraps=GroupActionLogEntry.objects.get_actions_for_group,
        ) as fetch:
            items = self._activity_items(limit=3)

        assert [call.args[1] for call in fetch.call_args_list] == [3, 6, 12, 24]

        assert [item["id"] for item in items] == [
            str(newer_action.id),
            str(older_action.id),
            str(comment.id),
            "0",
        ]
        assert items[:2] == before[:2]
        assert items[2] == {**before[2], "data": {**before[2]["data"], "text": "edit 15"}}
        assert items[3] == before[3]

    def test_initial_headroom_absorbs_boundary_edit_without_refetch(self) -> None:
        comment = self._comment(123, "original")
        older_action = self.create_group_action_log_entry(type=GroupActionType.RESOLVE)
        newer_action = self.create_group_action_log_entry(type=GroupActionType.UNRESOLVE)
        newest_action = self.create_group_action_log_entry(type=GroupActionType.RESOLVE)
        self._comment_mutation(GroupActionType.COMMENT_EDIT, comment, text="edited")

        with patch.object(
            GroupActionLogEntry.objects,
            "get_actions_for_group",
            wraps=GroupActionLogEntry.objects.get_actions_for_group,
        ) as fetch:
            items = self._activity_items(limit=4)

        fetch.assert_called_once_with(self.group, 5)
        assert [item["id"] for item in items] == [
            str(newest_action.id),
            str(newer_action.id),
            str(older_action.id),
            str(comment.id),
            "0",
        ]
        assert items[3]["data"]["text"] == "edited"

    def test_refetch_limit_returns_short_page(self) -> None:
        # These actions would fill the page, but lie beyond the final fetch window.
        self.create_group_action_log_entry(type=GroupActionType.RESOLVE)
        self.create_group_action_log_entry(type=GroupActionType.UNRESOLVE)
        for comment_id in range(1000, 1012):
            deleted = self._comment(comment_id, "deleted")
            self._comment_mutation(GroupActionType.COMMENT_DELETE, deleted)
        kept = self._comment(123, "original")
        self._comment_mutation(GroupActionType.COMMENT_EDIT, kept, text="edited")

        with patch.object(
            GroupActionLogEntry.objects,
            "get_actions_for_group",
            wraps=GroupActionLogEntry.objects.get_actions_for_group,
        ) as fetch:
            items = self._activity_items(limit=3)

        assert [call.args[1] for call in fetch.call_args_list] == [3, 6, 12, 24]
        assert [item["type"] for item in items] == ["note", "first_seen"]
        assert items[0]["id"] == str(kept.id)
        assert items[0]["data"]["text"] == "edited"

    def test_full_page_without_mutations_needs_only_one_fetch(self) -> None:
        action = self.create_group_action_log_entry(type=GroupActionType.RESOLVE)
        # A comment reference can match another action's id without colliding in the feed.
        comment = self._comment(action.id, "comment")

        with patch.object(
            GroupActionLogEntry.objects,
            "get_actions_for_group",
            wraps=GroupActionLogEntry.objects.get_actions_for_group,
        ) as fetch:
            items = self._activity_items(limit=2)

        fetch.assert_called_once_with(self.group, 2)
        assert [item["type"] for item in items] == ["note", "set_resolved", "first_seen"]
        assert [item["id"] for item in items] == [str(comment.id), str(action.id), "0"]
        assert items[0]["commentId"] == str(action.id)

    def test_deleted_comment_is_replaced_by_older_action(self) -> None:
        oldest_action = self.create_group_action_log_entry(type=GroupActionType.RESOLVE)
        comment = self._comment(123, "original")
        newer_action = self.create_group_action_log_entry(type=GroupActionType.UNRESOLVE)
        newest_action = self.create_group_action_log_entry(type=GroupActionType.RESOLVE)
        self._comment_mutation(GroupActionType.COMMENT_EDIT, comment, text="edited")
        self._comment_mutation(GroupActionType.COMMENT_DELETE, comment)

        items = self._activity_items(limit=3)

        assert [item["id"] for item in items] == [
            str(newest_action.id),
            str(newer_action.id),
            str(oldest_action.id),
            "0",
        ]
        assert items[-1]["type"] == "first_seen"

    def test_deleted_comment_is_replaced_by_older_comment(self) -> None:
        oldest = self._comment(123, "oldest")
        middle = self._comment(456, "middle")
        deleted = self._comment(789, "newest")
        self._comment_mutation(GroupActionType.COMMENT_DELETE, deleted)

        items = self._activity_items(limit=2)

        assert [item["id"] for item in items] == [str(middle.id), str(oldest.id), "0"]

    def test_comment_history_is_truncated_after_folding(self) -> None:
        oldest = self._comment(123, "oldest")
        middle = self._comment(456, "middle")
        newest = self._comment(789, "newest")
        self._comment_mutation(GroupActionType.COMMENT_EDIT, newest, text="edited")
        self._comment_mutation(GroupActionType.COMMENT_EDIT, oldest, text="still outside the page")

        items = self._activity_items(limit=2)

        assert [item["id"] for item in items] == [str(newest.id), str(middle.id), "0"]
        assert items[0]["data"]["text"] == "edited"
        assert items[-1]["type"] == "first_seen"

    def test_latest_comment_edit_wins(self) -> None:
        comment = self._comment(123, "original")
        self._comment_mutation(GroupActionType.COMMENT_EDIT, comment, text="first edit")
        self._comment_mutation(GroupActionType.COMMENT_EDIT, comment, text="second edit")

        items = self._activity_items()

        assert [item["type"] for item in items] == ["note", "first_seen"]
        assert items[0]["data"]["text"] == "second edit"

    def test_comment_delete_removes_the_comment(self) -> None:
        comment = self._comment(123, "original")
        self._comment_mutation(GroupActionType.COMMENT_DELETE, comment)

        with patch.object(
            GroupActionLogEntry.objects,
            "get_actions_for_group",
            wraps=GroupActionLogEntry.objects.get_actions_for_group,
        ) as fetch:
            items = self._activity_items(limit=2)

        # Stop once history is exhausted, even though no entries survive the fold.
        assert [call.args[1] for call in fetch.call_args_list] == [2, 4]
        assert [item["type"] for item in items] == ["first_seen"]

    def test_comment_delete_wins_over_an_earlier_edit(self) -> None:
        comment = self._comment(123, "original")
        self._comment_mutation(GroupActionType.COMMENT_EDIT, comment, text="edited")
        self._comment_mutation(GroupActionType.COMMENT_DELETE, comment)

        items = self._activity_items()

        assert [item["type"] for item in items] == ["first_seen"]

    def test_only_the_named_comment_is_folded(self) -> None:
        untouched = self._comment(123, "untouched")
        edited = self._comment(456, "original")
        self._comment_mutation(GroupActionType.COMMENT_EDIT, edited, text="edited")
        deleted = self._comment(789, "doomed")
        self._comment_mutation(GroupActionType.COMMENT_DELETE, deleted)
        self.create_group_action_log_entry(
            type=GroupActionType.TRIGGER_AUTOFIX,
            actor_type=GroupActorType.USER,
            actor_id=self.user.id,
            data={"referrer": "slack"},
        )

        items = self._activity_items()

        assert [item["type"] for item in items] == [
            "trigger_autofix",
            "note",
            "note",
            "first_seen",
        ]
        assert items[1]["id"] == str(edited.id)
        assert items[1]["data"]["text"] == "edited"
        assert items[2]["id"] == str(untouched.id)
        assert items[2]["data"]["text"] == "untouched"

    def test_comment_mutations_are_dropped_without_their_comment(self) -> None:
        # A missing COMMENT leaves nothing to fold into; its mutation must not render.
        orphan = self._comment(123, "original")
        self._comment_mutation(GroupActionType.COMMENT_EDIT, orphan, text="edited")
        orphan.delete()

        items = self._activity_items()

        assert [item["type"] for item in items] == ["first_seen"]
