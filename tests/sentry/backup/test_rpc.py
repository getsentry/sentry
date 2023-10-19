from __future__ import annotations

from copy import deepcopy
from functools import cached_property

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.models.project import Project
from sentry.models.user import MAX_USERNAME_LENGTH, User
from sentry.services.hybrid_cloud.import_export import import_export_service
from sentry.services.hybrid_cloud.import_export.model import (
    RpcExportError,
    RpcExportErrorKind,
    RpcExportScope,
    RpcImportError,
    RpcImportErrorKind,
    RpcImportFlags,
    RpcImportScope,
    RpcPrimaryKeyMap,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils import json

USER_MODEL_NAME = get_model_name(User)
PROJECT_MODEL_NAME = get_model_name(Project)


class RpcImportErrorTests(TestCase):
    """Validate errors related to the `import_by_model()` RPC method."""

    @staticmethod
    def is_user_model(model: json.JSONData) -> bool:
        return NormalizedModelName(model["model"]) == USER_MODEL_NAME

    @cached_property
    def _json_of_exhaustive_user_with_minimum_privileges(self) -> json.JSONData:
        with open(get_fixture_path("backup", "user-with-minimum-privileges.json")) as backup_file:
            return json.load(backup_file)

    def json_of_exhaustive_user_with_minimum_privileges(self) -> json.JSONData:
        return deepcopy(self._json_of_exhaustive_user_with_minimum_privileges)

    def test_bad_unknown_model(self):
        result = import_export_service.import_by_model(
            model_name="sentry.doesnotexist",
            scope=RpcImportScope.Global,
            flags=RpcImportFlags(),
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            json_data="",
        )

        assert isinstance(result, RpcImportError)
        assert result.get_kind() == RpcImportErrorKind.UnknownModel

    @assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False)
    def test_bad_incorrect_silo_mode_for_model(self):
        result = import_export_service.import_by_model(
            model_name=str(PROJECT_MODEL_NAME),
            scope=RpcImportScope.Global,
            flags=RpcImportFlags(),
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            json_data="",
        )

        assert isinstance(result, RpcImportError)
        assert result.get_kind() == RpcImportErrorKind.IncorrectSiloModeForModel

    def test_bad_unspecified_scope(self):
        result = import_export_service.import_by_model(
            model_name=str(USER_MODEL_NAME),
            flags=RpcImportFlags(),
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            json_data="",
        )

        assert isinstance(result, RpcImportError)
        assert result.get_kind() == RpcImportErrorKind.UnspecifiedScope

    def test_bad_invalid_json(self):
        result = import_export_service.import_by_model(
            model_name=str(USER_MODEL_NAME),
            scope=RpcImportScope.Global,
            flags=RpcImportFlags(),
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            json_data="_",
        )

        assert isinstance(result, RpcImportError)
        assert result.get_kind() == RpcImportErrorKind.DeserializationFailed

    def test_bad_validation(self):
        models = self.json_of_exhaustive_user_with_minimum_privileges()

        # Username too long - will fail deserialization.
        for model in models:
            if self.is_user_model(model):
                model["fields"]["username"] = "a" * (MAX_USERNAME_LENGTH + 1)

        json_data = json.dumps([m for m in models if self.is_user_model(m)])
        result = import_export_service.import_by_model(
            model_name=str(USER_MODEL_NAME),
            scope=RpcImportScope.Global,
            flags=RpcImportFlags(),
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            json_data=json_data,
        )

        assert isinstance(result, RpcImportError)
        assert result.get_kind() == RpcImportErrorKind.ValidationError

    def test_bad_unexpected_model(self):
        models = self.json_of_exhaustive_user_with_minimum_privileges()
        json_data = json.dumps([m for m in models if self.is_user_model(m)])
        result = import_export_service.import_by_model(
            model_name="sentry.option",
            scope=RpcImportScope.Global,
            flags=RpcImportFlags(),
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            json_data=json_data,
        )

        assert isinstance(result, RpcImportError)
        assert result.get_kind() == RpcImportErrorKind.UnexpectedModel


class RpcExportErrorTests(TestCase):
    """Validate errors related to the `export_by_model()` RPC method."""

    def test_bad_unknown_model(self):
        result = import_export_service.export_by_model(
            model_name="sentry.doesnotexist",
            scope=RpcExportScope.Global,
            from_pk=0,
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            indent=2,
        )

        assert isinstance(result, RpcExportError)
        assert result.get_kind() == RpcExportErrorKind.UnknownModel

    def test_bad_unexportable_model(self):
        result = import_export_service.export_by_model(
            model_name="sentry.controloutbox",
            scope=RpcExportScope.Global,
            from_pk=0,
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            indent=2,
        )

        assert isinstance(result, RpcExportError)
        assert result.get_kind() == RpcExportErrorKind.UnexportableModel

    @assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False)
    def test_bad_incorrect_silo_mode_for_model(self):
        result = import_export_service.export_by_model(
            model_name=str(PROJECT_MODEL_NAME),
            scope=RpcExportScope.Global,
            from_pk=0,
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            indent=2,
        )

        assert isinstance(result, RpcExportError)
        assert result.get_kind() == RpcExportErrorKind.IncorrectSiloModeForModel

    def test_bad_unspecified_scope(self):
        result = import_export_service.export_by_model(
            model_name=str(USER_MODEL_NAME),
            scope=None,
            from_pk=0,
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            indent=2,
        )

        assert isinstance(result, RpcExportError)
        assert result.get_kind() == RpcExportErrorKind.UnspecifiedScope
