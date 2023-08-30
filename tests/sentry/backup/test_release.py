from __future__ import annotations

from typing import Literal, Type

from sentry.backup.helpers import get_exportable_sentry_models
from sentry.testutils.helpers.backups import BackupTestCase
from tests.sentry.backup import run_backup_tests_only_on_single_db, targets

RELEASE_TESTED_MODELS = set()


def mark(*marking: Type | Literal["__all__"]):
    """A function that runs at module load time and marks all models that appear in
    `test_at_head_...()` below.

    Use the sentinel string "__all__" to indicate that all models are expected."""

    all: Literal["__all__"] = "__all__"
    for model in marking:
        if model == all:
            all_models = get_exportable_sentry_models()
            RELEASE_TESTED_MODELS.update({c.__name__ for c in all_models})
            return list(all_models)

        RELEASE_TESTED_MODELS.add(model.__name__)
    return marking


@run_backup_tests_only_on_single_db
class ReleaseTests(BackupTestCase):
    """Ensure that the all Sentry models are still exportable."""

    @targets(mark("__all__"))
    def test_at_head_clean_pks(self):
        self.create_exhaustive_instance(is_superadmin=True)
        return self.import_export_then_validate(self._testMethodName, reset_pks=True)

    @targets(mark("__all__"))
    def test_at_head_dirty_pks(self):
        self.create_exhaustive_instance(is_superadmin=True)
        return self.import_export_then_validate(self._testMethodName, reset_pks=False)
