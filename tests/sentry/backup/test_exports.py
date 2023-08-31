from __future__ import annotations

import tempfile
from pathlib import Path

from sentry.backup.helpers import get_exportable_sentry_models
from sentry.backup.scopes import ExportScope
from sentry.testutils.helpers.backups import BackupTestCase, export_to_file
from tests.sentry.backup import run_backup_tests_only_on_single_db


@run_backup_tests_only_on_single_db
class ScopingTests(BackupTestCase):
    """
    Ensures that only models with the allowed relocation scopes are actually exported.
    """

    @staticmethod
    def get_models_for_scope(scope: ExportScope) -> set[str]:
        matching_models = set()
        for model in get_exportable_sentry_models():
            if model.__relocation_scope__ in scope.value:
                obj_name = model._meta.object_name
                if obj_name is not None:
                    matching_models.add("sentry." + obj_name.lower())
        return matching_models

    def test_user_export_scoping(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            matching_models = self.get_models_for_scope(ExportScope.User)
            self.create_exhaustive_instance(is_superadmin=True)
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            data = export_to_file(tmp_path, ExportScope.User)

            for entry in data:
                model_name = entry["model"]
                if model_name not in matching_models:
                    raise AssertionError(
                        f"Model `${model_name}` was included in export despite not being `Relocation.User`"
                    )

    def test_organization_export_scoping(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            matching_models = self.get_models_for_scope(ExportScope.Organization)
            self.create_exhaustive_instance(is_superadmin=True)
            tmp_path = Path(tmp_dir).joinpath(f"{self._testMethodName}.json")
            data = export_to_file(tmp_path, ExportScope.Organization)

            for entry in data:
                model_name = entry["model"]
                if model_name not in matching_models:
                    raise AssertionError(
                        f"Model `${model_name}` was included in export despite not being `Relocation.User` or `Relocation.Organization`"
                    )
