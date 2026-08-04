from unittest import mock

from django.db import connections
from django.db.migrations.state import ModelState
from django.db.utils import DEFAULT_DB_ALIAS

from sentry.management.commands.pending_deletion_ddl import (
    collect_pending_deletion_ddl,
    squashed_apps_from_lockfile,
)
from sentry.models.organization import Organization
from sentry.new_migrations.monkey.state import DeletionAction, SentryProjectState
from sentry.testutils.cases import TestCase


class CollectPendingDeletionDDLTest(TestCase):
    def _state_with_model(self, model: type) -> SentryProjectState:
        state = SentryProjectState()
        state.add_model(ModelState.from_model(model))
        return state

    def test_pending_field_emits_add_column(self) -> None:
        state = self._state_with_model(Organization)
        field = Organization._meta.get_field("is_test")
        state.pending_deletion_fields[("sentry", "organization", "is_test")] = field

        sql = collect_pending_deletion_ddl(
            state, connections[DEFAULT_DB_ALIAS], squashed_apps={"sentry"}
        )

        assert any('ADD COLUMN "is_test"' in stmt and "sentry_organization" in stmt for stmt in sql)

    def test_field_in_unsquashed_app_is_skipped(self) -> None:
        state = self._state_with_model(Organization)
        field = Organization._meta.get_field("is_test")
        state.pending_deletion_fields[("sentry", "organization", "is_test")] = field

        sql = collect_pending_deletion_ddl(
            state, connections[DEFAULT_DB_ALIAS], squashed_apps={"getsentry"}
        )

        assert sql == []

    def test_pending_field_on_removed_model_is_skipped(self) -> None:
        state = SentryProjectState()
        field = Organization._meta.get_field("is_test")
        state.pending_deletion_fields[("sentry", "organization", "is_test")] = field

        sql = collect_pending_deletion_ddl(
            state, connections[DEFAULT_DB_ALIAS], squashed_apps={"sentry"}
        )

        assert sql == []

    def test_pending_indexed_field_emits_dependent_index(self) -> None:
        state = self._state_with_model(Organization)
        field = Organization._meta.get_field("slug")
        state.pending_deletion_fields[("sentry", "organization", "slug")] = field

        sql = collect_pending_deletion_ddl(
            state, connections[DEFAULT_DB_ALIAS], squashed_apps={"sentry"}
        )

        assert any('ADD COLUMN "slug"' in stmt for stmt in sql)
        assert any("CREATE INDEX" in stmt and "slug" in stmt for stmt in sql)

    def test_pending_model_emits_create_table(self) -> None:
        state = SentryProjectState()
        state.pending_deletion_models[("sentry", "organization")] = Organization

        sql = collect_pending_deletion_ddl(
            state, connections[DEFAULT_DB_ALIAS], squashed_apps={"sentry"}
        )

        assert any("CREATE TABLE" in stmt and "sentry_organization" in stmt for stmt in sql)

    def test_field_pending_before_its_model_is_reconstituted(self) -> None:
        state = SentryProjectState()
        state.add_model(ModelState.from_model(Organization))
        state.remove_field(
            "sentry", "organization", "is_test", deletion_action=DeletionAction.MOVE_TO_PENDING
        )
        state.remove_model("sentry", "organization", deletion_action=DeletionAction.MOVE_TO_PENDING)

        sql = collect_pending_deletion_ddl(
            state, connections[DEFAULT_DB_ALIAS], squashed_apps={"sentry"}
        )

        assert any("CREATE TABLE" in stmt and "sentry_organization" in stmt for stmt in sql)
        assert any('ADD COLUMN "is_test"' in stmt for stmt in sql)

    def test_model_not_routed_to_alias_is_skipped(self) -> None:
        state = self._state_with_model(Organization)
        field = Organization._meta.get_field("is_test")
        state.pending_deletion_fields[("sentry", "organization", "is_test")] = field
        state.pending_deletion_models[("sentry", "organization")] = Organization

        with mock.patch(
            "sentry.management.commands.pending_deletion_ddl.router.allow_migrate_model",
            return_value=False,
        ):
            sql = collect_pending_deletion_ddl(
                state, connections[DEFAULT_DB_ALIAS], squashed_apps={"sentry"}
            )

        assert sql == []


class SquashedAppsFromLockfileTest(TestCase):
    def test_includes_unsquashed_and_excludes_already_squashed(self) -> None:
        contents = (
            "ai_monitoring: 0001_create_ai_conversation_metadata\n"
            "\n"
            "discover: 0001_squashed_0003_discover_json_field\n"
            "\n"
            "explore: 0010_remove_last_received_from_attribute_context\n"
        )

        apps = squashed_apps_from_lockfile(contents)

        assert "ai_monitoring" in apps
        assert "explore" in apps
        assert "discover" not in apps
