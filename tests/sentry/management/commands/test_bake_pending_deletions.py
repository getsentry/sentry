import textwrap
from typing import Any

from django.db import models
from django.db.migrations.state import ModelState

from sentry.discover.models import DiscoverSavedQuery
from sentry.management.commands.bake_pending_deletions import (
    AppInjection,
    apps_without_squash_file,
    build_injection_payload,
)
from sentry.models.organization import Organization
from sentry.new_migrations.monkey.state import SentryProjectState
from sentry.testutils.cases import TestCase


def _eval_ops(payload: AppInjection) -> list[Any]:
    ns: dict[str, Any] = {}
    for imp in payload["imports"]:
        exec(imp, ns)
    exec("from django.db import migrations, models", ns)
    exec("import sentry.new_migrations.monkey.fields", ns)
    exec("import sentry.new_migrations.monkey.models", ns)
    exec("import sentry.new_migrations.monkey.state", ns)
    return [eval(textwrap.dedent(text).strip().rstrip(","), ns) for text in payload["operations"]]


class BuildInjectionPayloadTest(TestCase):
    def _state_with_model(self, model: type) -> SentryProjectState:
        state = SentryProjectState()
        state.add_model(ModelState.from_model(model))
        return state

    def _pend_field(self, state: SentryProjectState, key: tuple[str, str, str], field: Any) -> None:
        """Mirror a real MOVE_TO_PENDING: gone from state, present in the registry."""
        app_label, model_name, field_name = key
        model_state = state.models.get((app_label, model_name))
        if model_state is not None:
            model_state.fields.pop(field_name, None)
        state.pending_deletion_fields[key] = field

    def test_pending_field_emits_add_and_saferemove(self) -> None:
        state = self._state_with_model(Organization)
        field = Organization._meta.get_field("is_test")
        self._pend_field(state, ("sentry", "organization", "is_test"), field)

        payload = build_injection_payload(state, squashed_apps={"sentry"})

        ops = "\n".join(payload["sentry"]["operations"])
        assert "AddField(" in ops
        assert "SafeRemoveField(" in ops
        assert "name='is_test'" in ops
        assert "MOVE_TO_PENDING" in ops
        assert "import sentry.new_migrations.monkey.fields" in payload["sentry"]["imports"]

    def test_field_in_unsquashed_app_is_skipped(self) -> None:
        state = self._state_with_model(Organization)
        field = Organization._meta.get_field("is_test")
        self._pend_field(state, ("sentry", "organization", "is_test"), field)

        payload = build_injection_payload(state, squashed_apps={"getsentry"})

        assert payload == {}

    def test_field_on_removed_model_is_skipped(self) -> None:
        state = SentryProjectState()
        field = Organization._meta.get_field("is_test")
        self._pend_field(state, ("sentry", "organization", "is_test"), field)

        payload = build_injection_payload(state, squashed_apps={"sentry"})

        assert payload == {}

    def test_pending_model_emits_create_and_safedelete(self) -> None:
        state = SentryProjectState()
        state.pending_deletion_models[("sentry", "organization")] = Organization

        payload = build_injection_payload(state, squashed_apps={"sentry"})

        ops = "\n".join(payload["sentry"]["operations"])
        assert "CreateModel(" in ops
        assert "SafeDeleteModel(" in ops
        assert "import sentry.new_migrations.monkey.models" in payload["sentry"]["imports"]

    def test_model_group_emits_create_add_remove_delete_in_order(self) -> None:
        # the normal case: the field was pended first, so the stored model class
        # was rendered without it and the CreateModel must not carry it
        state = SentryProjectState()
        state.pending_deletion_models[("sentry", "organization")] = Organization
        field: models.Field = models.IntegerField(null=True)
        field.set_attributes_from_name("dropped_col")
        self._pend_field(state, ("sentry", "organization", "dropped_col"), field)

        payload = build_injection_payload(state, squashed_apps={"sentry"})

        kinds = [type(op).__name__ for op in _eval_ops(payload["sentry"])]
        assert kinds == ["CreateModel", "AddField", "SafeRemoveField", "SafeDeleteModel"], kinds

    def test_field_carried_by_stored_pending_model_is_not_re_added(self) -> None:
        """A field pended then re-added leaves a stale registry key; once the model
        is pended too, its stored class already carries the field."""
        state = SentryProjectState()
        state.pending_deletion_models[("sentry", "organization")] = Organization
        field = Organization._meta.get_field("is_test")
        self._pend_field(state, ("sentry", "organization", "is_test"), field)

        payload = build_injection_payload(state, squashed_apps={"sentry"})
        ops = _eval_ops(payload["sentry"])

        create = ops[0]
        assert "is_test" in [name for name, _ in create.fields]
        assert [type(op).__name__ for op in ops if type(op).__name__ == "AddField"] == []
        assert [type(op).__name__ for op in ops] == [
            "CreateModel",
            "SafeRemoveField",
            "SafeDeleteModel",
        ]

    def test_non_relational_field_emits_no_dependency(self) -> None:
        state = self._state_with_model(Organization)
        field = Organization._meta.get_field("is_test")
        self._pend_field(state, ("sentry", "organization", "is_test"), field)

        payload = build_injection_payload(state, squashed_apps={"sentry"})

        assert payload["sentry"]["dependencies"] == []

    def test_relation_to_other_app_is_recorded(self) -> None:
        state = self._state_with_model(DiscoverSavedQuery)
        field = DiscoverSavedQuery._meta.get_field("explore_query")
        assert field.remote_field.model._meta.app_label == "explore"
        self._pend_field(state, ("discover", "discoversavedquery", "explore_query"), field)

        payload = build_injection_payload(state, squashed_apps={"discover"})

        assert ("explore", "__first__") in payload["discover"]["dependencies"]

    def test_pending_model_relation_to_other_app_is_recorded(self) -> None:
        state = SentryProjectState()
        state.pending_deletion_models[("discover", "discoversavedquery")] = DiscoverSavedQuery

        payload = build_injection_payload(state, squashed_apps={"discover"})

        assert ("explore", "__first__") in payload["discover"]["dependencies"]

    def test_m2m_through_in_other_app_is_recorded(self) -> None:
        state = self._state_with_model(DiscoverSavedQuery)
        field: models.Field = models.ManyToManyField(
            "discover.DiscoverSavedQuery", through="explore.Thing"
        )
        self._pend_field(state, ("discover", "discoversavedquery", "things"), field)

        payload = build_injection_payload(state, squashed_apps={"discover"})

        assert ("explore", "__first__") in payload["discover"]["dependencies"]

    def test_m2m_records_both_to_and_through_apps(self) -> None:
        state = self._state_with_model(DiscoverSavedQuery)
        field: models.Field = models.ManyToManyField("sentry.Project", through="explore.Thing")
        self._pend_field(state, ("discover", "discoversavedquery", "things"), field)

        payload = build_injection_payload(state, squashed_apps={"discover"})

        deps = payload["discover"]["dependencies"]
        assert ("sentry", "__first__") in deps
        assert ("explore", "__first__") in deps
        assert len(deps) == len(set(deps))

    def test_bound_m2m_through_model_class_is_resolved(self) -> None:
        state = self._state_with_model(DiscoverSavedQuery)
        field = DiscoverSavedQuery._meta.get_field("projects")
        through = field.remote_field.through
        assert through is not None
        assert through._meta.app_label == "discover"
        self._pend_field(state, ("discover", "discoversavedquery", "projects"), field)

        payload = build_injection_payload(state, squashed_apps={"discover"})

        deps = payload["discover"]["dependencies"]
        assert ("sentry", "__first__") in deps
        assert ("discover", "__first__") not in deps


class AppsWithoutSquashFileTest(TestCase):
    def test_app_with_only_pending_model_is_flagged(self) -> None:
        state = SentryProjectState()
        state.pending_deletion_models[("sentry", "organization")] = Organization

        payload = build_injection_payload(state, squashed_apps={"sentry"})

        assert apps_without_squash_file(state, payload) == {"sentry"}

    def test_app_with_a_live_model_is_not_flagged(self) -> None:
        state = SentryProjectState()
        state.add_model(ModelState.from_model(Organization))
        field: Any = Organization._meta.get_field("is_test")
        state.models[("sentry", "organization")].fields.pop("is_test", None)
        state.pending_deletion_fields[("sentry", "organization", "is_test")] = field

        payload = build_injection_payload(state, squashed_apps={"sentry"})

        assert apps_without_squash_file(state, payload) == set()

    def test_empty_payload_flags_nothing(self) -> None:
        state = SentryProjectState()

        assert apps_without_squash_file(state, {}) == set()
