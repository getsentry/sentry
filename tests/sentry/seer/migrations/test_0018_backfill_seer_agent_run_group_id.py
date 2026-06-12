from importlib import import_module

from django.apps import apps as global_apps
from django.utils import timezone

from sentry.models.organization import Organization
from sentry.seer.models.run import SeerAgentRun, SeerRun
from sentry.testutils.cases import TestCase

# The migration module name starts with a digit, so it can't be imported with a
# normal `from ... import`. The data migration is pure Python (no schema change),
# so we exercise the backfill function directly instead of paying for the slow
# TestMigrations apply harness — the migration's apply is covered by CI's
# `check migration` job.
backfill_seer_agent_run_group_id = import_module(
    "sentry.seer.migrations.0018_backfill_seer_agent_run_group_id"
).backfill_seer_agent_run_group_id


class BackfillSeerAgentRunGroupIdTest(TestCase):
    def _make_agent_run(
        self,
        source: str,
        extras: dict[str, str],
        run_org: Organization | None = None,
        group_id: int | None = None,
    ) -> SeerAgentRun:
        run = SeerRun.objects.create(
            organization=run_org or self.organization,
            type="explorer",
            last_triggered_at=timezone.now(),
        )
        return SeerAgentRun.objects.create(
            run=run,
            title="t",
            source=source,
            group_id=group_id,
            extras=extras,
        )

    def test_backfill(self) -> None:
        # org A is the default fixture org; org B is a separate org used to prove
        # cross-tenant links are rejected.
        other_org = self.create_organization()
        other_group = self.create_group(project=self.create_project(organization=other_org))

        # Backfilled: autofix run whose group belongs to the run's org.
        resolvable = self._make_agent_run("autofix", {"category_value": str(self.group.id)})

        # Untouched: already has a group_id.
        already_set = self._make_agent_run(
            "autofix", {"category_value": "123"}, group_id=self.group.id
        )

        # Skipped: category_value points to a group in a DIFFERENT org.
        cross_org = self._make_agent_run("autofix", {"category_value": str(other_group.id)})

        # Skipped: category_value points to a group that doesn't exist.
        missing_group = self._make_agent_run("autofix", {"category_value": "987654321"})

        # Skipped: non-autofix source (category_value is not a group id here).
        non_autofix = self._make_agent_run(
            "dashboard_generate", {"category_value": str(self.group.id)}
        )

        # Skipped: missing / non-numeric / unicode-digit / oversized category_value.
        missing_value = self._make_agent_run("autofix", {})
        bad_value = self._make_agent_run("autofix", {"category_value": "not-a-number"})
        unicode_digit = self._make_agent_run("autofix", {"category_value": "²"})
        oversized = self._make_agent_run(
            "autofix", {"category_value": "99999999999999999999999999"}
        )

        backfill_seer_agent_run_group_id(global_apps, None)

        def group_id_of(run: SeerAgentRun) -> int | None:
            run.refresh_from_db()
            return run.group_id

        # Only the same-org autofix row is linked.
        assert group_id_of(resolvable) == self.group.id
        # Pre-existing group_id is left untouched (not overwritten from category_value).
        assert group_id_of(already_set) == self.group.id
        # Everything else is skipped — group_id stays NULL.
        assert group_id_of(cross_org) is None
        assert group_id_of(missing_group) is None
        assert group_id_of(non_autofix) is None
        assert group_id_of(missing_value) is None
        assert group_id_of(bad_value) is None
        assert group_id_of(unicode_digit) is None
        assert group_id_of(oversized) is None
