from datetime import datetime, timedelta
from typing import Any

from django.db import connections, router
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

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
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.utils.action_log.activity_translator import activity_to_action


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

    def test_legacy_mcp_client_family_source_is_renamed(self) -> None:
        user = self.create_user()
        group = self.create_group()
        legacy = self.create_group_action_log_entry(
            group=group, type=GroupActionType.RESOLVE, source="mcp:claude-desktop"
        )
        current = self.create_group_action_log_entry(
            group=group, type=GroupActionType.RESOLVE, source="mcp:claude-code"
        )

        legacy_result, current_result = serialize([legacy, current], user)

        assert legacy_result["source"] == "mcp:claude"
        assert current_result["source"] == "mcp:claude-code"

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

        for activity_type in (
            ActivityType.SET_RESOLVED_IN_COMMIT,
            ActivityType.SET_RESOLVED_IN_RELEASE,
        ):
            activity = self.create_group_activity(
                group=group, type=activity_type.value, data={"commit": commit.id}
            )
            action = activity_to_action(activity)
            assert action is not None
            entry = self.create_group_action_log_entry(
                group=group,
                type=action.get_type(),
                actor_type=GroupActorType.USER,
                actor_id=user.id,
                data=action.dict(),
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
            idempotency_key=f"activity:{comment_id}",
            source="web",
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

    def _first_seen(
        self, group_id: int | None = None, first_seen: datetime | None = None
    ) -> GroupActionLogEntry:
        return self.create_group_action_log_entry(
            type=GroupActionType.FIRST_SEEN,
            source="system",
            data={"first_seen": (first_seen or self.group.first_seen).isoformat()},
            idempotency_key=f"first_seen:{group_id or self.group.id}",
        )

    def test_logged_first_seen_is_not_duplicated(self) -> None:
        first_seen = self._first_seen()
        resolve = self.create_group_action_log_entry(type=GroupActionType.RESOLVE)

        items = self._activity_items()

        assert [item["type"] for item in items] == ["set_resolved", "first_seen"]
        assert items[0]["id"] == str(resolve.id)
        assert items[1]["id"] == str(first_seen.id)
        assert items[1]["source"] == "system"
        assert items[1]["dateCreated"] == self.group.first_seen

    def test_logged_first_seen_uses_the_entry_first_seen(self) -> None:
        entry_first_seen = self.group.first_seen - timedelta(days=1)
        self._first_seen(first_seen=entry_first_seen)

        items = self._activity_items()

        assert items[-1]["type"] == "first_seen"
        assert items[-1]["dateCreated"] == entry_first_seen

    def test_first_seen_that_is_not_oldest_is_dropped(self) -> None:
        own_first_seen = self._first_seen()
        self.create_group_action_log_entry(type=GroupActionType.RESOLVE)
        # e.g. carried over from a group merged into this one
        self._first_seen(group_id=self.group.id + 1)

        items = self._activity_items()

        assert [item["type"] for item in items] == ["set_resolved", "first_seen"]
        assert items[1]["id"] == str(own_first_seen.id)

    def test_first_seen_is_synthesized_when_not_oldest_in_log(self) -> None:
        resolve = self.create_group_action_log_entry(type=GroupActionType.RESOLVE)
        self._first_seen(group_id=self.group.id + 1)

        items = self._activity_items()

        assert [item["id"] for item in items] == [str(resolve.id), "0"]
        assert items[1]["type"] == "first_seen"

    def test_dropped_first_seen_entries_do_not_shrink_the_page(self) -> None:
        own_first_seen = self._first_seen()
        resolve = self.create_group_action_log_entry(type=GroupActionType.RESOLVE)
        unresolve = self.create_group_action_log_entry(type=GroupActionType.UNRESOLVE)
        # e.g. carried over from groups merged into this one
        for offset in range(1, 4):
            self._first_seen(group_id=self.group.id + offset)

        items = self._activity_items(limit=2)

        assert [item["id"] for item in items] == [
            str(unresolve.id),
            str(resolve.id),
            str(own_first_seen.id),
        ]

    @with_feature({"projects:issue-action-log-write-to-db": False})
    def test_comments_use_current_activity_state(self) -> None:
        note = self.create_group_activity(
            type=ActivityType.NOTE.value, user_id=self.user.id, data={"text": "latest edit"}
        )
        logged = self._comment(note.id, "original")
        self._comment_mutation(GroupActionType.COMMENT_EDIT, logged, text="stale edit")
        missing = self.create_group_activity(
            type=ActivityType.NOTE.value, data={"text": "no creation event"}
        )
        deleted = self.create_group_activity(type=ActivityType.NOTE.value, data={"text": "deleted"})
        self._comment(deleted.id, "deleted")
        deleted.delete()  # No deletion event: Activity alone determines existence.
        self.create_group_action_log_entry(type=GroupActionType.VIEW)
        self.create_group_activity(
            group=self.create_group(), type=ActivityType.NOTE.value, data={"text": "other group"}
        )

        items = self._activity_items()

        assert [item["id"] for item in items] == [str(missing.id), str(note.id), "0"]
        assert items[0]["source"] is None
        assert items[1]["commentId"] == str(note.id)
        assert items[1]["data"] == {"text": "latest edit", "comment_id": note.id}
        assert items[1]["source"] == "web"
        assert items[1]["user"]["id"] == str(self.user.id)
        assert items[1]["dateCreated"] == note.datetime

    @with_feature({"projects:issue-action-log-write-to-db": False})
    def test_mutations_do_not_displace_comments_or_require_refetching(self) -> None:
        note = self.create_group_activity(type=ActivityType.NOTE.value, data={"text": "edited"})
        logged = self._comment(note.id, "original")
        older_action = self.create_group_action_log_entry(
            type=GroupActionType.RESOLVE,
            date_added=note.datetime + timedelta(seconds=1),
        )
        newer_action = self.create_group_action_log_entry(
            type=GroupActionType.UNRESOLVE,
            date_added=note.datetime + timedelta(seconds=2),
        )
        for edit_number in range(30):
            self._comment_mutation(GroupActionType.COMMENT_EDIT, logged, text=f"edit {edit_number}")
        deleted = self._comment(note.id + 1, "deleted")
        self._comment_mutation(GroupActionType.COMMENT_DELETE, deleted)

        with CaptureQueriesContext(connections[router.db_for_read(GroupActionLogEntry)]) as queries:
            items = self._activity_items(limit=3)

        assert [item["id"] for item in items] == [
            str(newer_action.id),
            str(older_action.id),
            str(note.id),
            "0",
        ]
        assert items[2]["data"]["text"] == "edited"
        log_queries = [q["sql"] for q in queries if 'FROM "sentry_groupactionlogentry"' in q["sql"]]
        # One oldest-entry lookup, one limited non-comment query, one source lookup.
        assert len(log_queries) == 3
        assert "LIMIT 3" in log_queries[1]
        assert "NOT" in log_queries[1]

    @with_feature({"projects:issue-action-log-write-to-db": False})
    def test_tied_timestamps_and_overlapping_ids(self) -> None:
        first_seen = self._first_seen()
        timestamp = first_seen.date_added + timedelta(seconds=1)
        for comment_id in (9, 10):
            self.create_group_activity(
                id=comment_id,
                type=ActivityType.NOTE.value,
                data={"text": "comment"},
                datetime=timestamp,
            )
        for action_id in (9, 10):
            self.create_group_action_log_entry(
                id=action_id,
                type=GroupActionType.RESOLVE,
                date_added=timestamp,
            )

        items = self._activity_items(limit=4)

        assert [(item["type"], item["id"]) for item in items] == [
            ("note", "10"),
            ("note", "9"),
            ("set_resolved", "10"),
            ("set_resolved", "9"),
            ("first_seen", str(first_seen.id)),
        ]
        assert [item["commentId"] for item in items] == ["10", "9", None, None, None]

    @with_feature({"projects:issue-action-log-write-to-db": False})
    def test_limit_is_applied_after_merging_both_sources(self) -> None:
        self._first_seen()
        timestamp = timezone.now()
        older_note = self.create_group_activity(
            type=ActivityType.NOTE.value,
            data={"text": "old"},
            datetime=timestamp - timedelta(days=1),
        )
        note = self.create_group_activity(
            type=ActivityType.NOTE.value,
            data={"text": "new"},
            datetime=timestamp + timedelta(seconds=1),
        )
        action = self.create_group_action_log_entry(
            type=GroupActionType.RESOLVE, date_added=timestamp
        )
        newest_action = self.create_group_action_log_entry(
            type=GroupActionType.UNRESOLVE, date_added=timestamp + timedelta(seconds=2)
        )
        with CaptureQueriesContext(connections[router.db_for_read(GroupActionLogEntry)]) as queries:
            items = self._activity_items(limit=2)

        assert [(item["type"], item["id"]) for item in items[:-1]] == [
            ("set_unresolved", str(newest_action.id)),
            ("note", str(note.id)),
        ]
        assert items[-1]["type"] == "first_seen"
        source_queries = [q["sql"] for q in queries if '"idempotency_key" IN' in q["sql"]]
        assert len(source_queries) == 1
        assert f"'activity:{note.id}'" in source_queries[0]
        assert f"'activity:{older_note.id}'" not in source_queries[0]
        assert all(item["id"] != str(action.id) for item in items if item["type"] != "note")

    @with_feature({"projects:issue-action-log-write-to-db": False})
    def test_comment_only_log_does_not_fall_back(self) -> None:
        note = self.create_group_activity(type=ActivityType.NOTE.value, data={"text": "comment"})
        logged = self._comment(note.id, "stale")

        items = self._activity_items()

        assert [item["type"] for item in items] == ["note", "first_seen"]
        assert items[0]["data"]["text"] == "comment"
        note.delete()
        self._comment_mutation(GroupActionType.COMMENT_DELETE, logged)
        assert [item["type"] for item in self._activity_items()] == ["first_seen"]
