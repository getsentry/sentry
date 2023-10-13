from __future__ import annotations

from sentry.backup.dependencies import get_model_name
from sentry.models.project import Project
from sentry.models.user import User
from sentry.services.hybrid_cloud.import_export import import_export_service
from sentry.services.hybrid_cloud.import_export.model import (
    RpcExportError,
    RpcExportErrorKind,
    RpcExportScope,
    RpcPrimaryKeyMap,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode

USER_MODEL_NAME = get_model_name(User)
PROJECT_MODEL_NAME = get_model_name(Project)


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
