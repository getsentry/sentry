from __future__ import annotations

from copy import deepcopy
from functools import cached_property
from typing import Optional, Type
from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.db import models

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.models.importchunk import ControlImportChunk, RegionImportChunk
from sentry.models.options.option import ControlOption, Option
from sentry.models.project import Project
from sentry.models.user import MAX_USERNAME_LENGTH, User
from sentry.services.hybrid_cloud.import_export import import_export_service
from sentry.services.hybrid_cloud.import_export.impl import get_existing_import_chunk
from sentry.services.hybrid_cloud.import_export.model import (
    RpcExportError,
    RpcExportErrorKind,
    RpcExportScope,
    RpcImportError,
    RpcImportErrorKind,
    RpcImportFlags,
    RpcImportOk,
    RpcImportScope,
    RpcPrimaryKeyMap,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils import json

CONTROL_OPTION_MODEL_NAME = get_model_name(ControlOption)
OPTION_MODEL_NAME = get_model_name(Option)
PROJECT_MODEL_NAME = get_model_name(Project)
USER_MODEL_NAME = get_model_name(User)


class RpcImportRetryTests(TestCase):
    """
    Ensure that retries don't duplicate writes.
    """

    def test_good_local_retry_idempotent(self):
        # If the response gets lost on the way to the caller, it will try again. Make sure it is
        # clever enough to not try to write the data twice if its already been committed.
        import_uuid = str(uuid4().hex)

        option_count = Option.objects.count()
        import_chunk_count = RegionImportChunk.objects.count()

        def verify_option_write():
            nonlocal option_count, import_chunk_count, import_uuid

            result = import_export_service.import_by_model(
                model_name="sentry.option",
                scope=RpcImportScope.Global,
                flags=RpcImportFlags(import_uuid=import_uuid),
                filter_by=[],
                pk_map=RpcPrimaryKeyMap(),
                json_data="""
                [
                    {
                        "model": "sentry.option",
                        "pk": 5,
                        "fields": {
                            "key": "foo",
                            "last_updated": "2023-06-22T00:00:00.000Z",
                            "last_updated_by": "unknown",
                            "value": "bar"
                        }
                    }
                ]
                """,
            )

            assert isinstance(result, RpcImportOk)
            assert result.min_ordinal == 1
            assert result.max_ordinal == 1
            assert result.min_source_pk == 5
            assert result.max_source_pk == 5
            assert result.min_inserted_pk == result.max_inserted_pk
            assert len(result.mapped_pks.from_rpc().mapping[str(OPTION_MODEL_NAME)]) == 1

            assert Option.objects.count() == option_count + 1
            assert RegionImportChunk.objects.count() == import_chunk_count + 1

            import_chunk = RegionImportChunk.objects.get(import_uuid=import_uuid)
            assert import_chunk.min_ordinal == 1
            assert import_chunk.max_ordinal == 1
            assert import_chunk.min_source_pk == 5
            assert import_chunk.max_source_pk == 5
            assert import_chunk.min_inserted_pk == import_chunk.max_inserted_pk
            assert len(import_chunk.inserted_map) == 1
            assert len(import_chunk.existing_map) == 0
            assert len(import_chunk.overwrite_map) == 0

        # Doing the write twice should produce identical results from the sender's point of view,
        # and should not result in multiple `RegionImportChunk`s being written.
        verify_option_write()
        verify_option_write()

    def test_good_remote_retry_idempotent(self):
        # If the response gets lost on the way to the caller, it will try again. Make sure it is
        # clever enough to not try to write the data twice if its already been committed.
        import_uuid = str(uuid4().hex)

        with assume_test_silo_mode(SiloMode.CONTROL):
            control_option_count = ControlOption.objects.count()
            import_chunk_count = ControlImportChunk.objects.count()

        def verify_control_option_write():
            nonlocal control_option_count, import_chunk_count, import_uuid

            result = import_export_service.import_by_model(
                model_name="sentry.controloption",
                scope=RpcImportScope.Global,
                flags=RpcImportFlags(import_uuid=import_uuid),
                filter_by=[],
                pk_map=RpcPrimaryKeyMap(),
                json_data="""
                [
                    {
                        "model": "sentry.controloption",
                        "pk": 7,
                        "fields": {
                            "key": "foo",
                            "last_updated": "2023-06-22T00:00:00.000Z",
                            "last_updated_by": "unknown",
                            "value": "bar"
                        }
                    }
                ]
                """,
            )

            assert isinstance(result, RpcImportOk)
            assert result.min_ordinal == 1
            assert result.max_ordinal == 1
            assert result.min_source_pk == 7
            assert result.max_source_pk == 7
            assert result.min_inserted_pk == result.max_inserted_pk
            assert len(result.mapped_pks.from_rpc().mapping[str(CONTROL_OPTION_MODEL_NAME)]) == 1

            with assume_test_silo_mode(SiloMode.CONTROL):
                assert ControlOption.objects.count() == control_option_count + 1
                assert ControlImportChunk.objects.count() == import_chunk_count + 1

                import_chunk = ControlImportChunk.objects.get(import_uuid=import_uuid)
                assert import_chunk.min_ordinal == 1
                assert import_chunk.max_ordinal == 1
                assert import_chunk.min_source_pk == 7
                assert import_chunk.max_source_pk == 7
                assert import_chunk.min_inserted_pk == import_chunk.max_inserted_pk
                assert len(import_chunk.inserted_map) == 1
                assert len(import_chunk.existing_map) == 0
                assert len(import_chunk.overwrite_map) == 0

        # Doing the write twice should produce identical results from the sender's point of view,
        # and should not result in multiple `ControlImportChunk`s being written.
        verify_control_option_write()
        verify_control_option_write()

    # This is a bit of a hacky way in which to "simulate" a race that occurs between when we first
    # try to detect the duplicate chunk and when we try to send our actual write.
    def test_good_handles_racing_imports(self):
        mock_call_count = 0

        # First call returns `None`, but then, by the time we get around to trying to commit the
        # atomic transaction, another mocked concurrent process has written the same chunk. We
        # should handle this gracefully by going and getting
        def wrapped_get_existing_import_chunk(
            model_name: NormalizedModelName,
            flags: ImportFlags,
            import_chunk_type: Type[models.base.Model],
        ) -> Optional[RpcImportOk]:
            nonlocal mock_call_count
            mock_call_count += 1
            if mock_call_count > 1:
                return get_existing_import_chunk(model_name, flags, import_chunk_type)

            return None

        with patch(
            "sentry.services.hybrid_cloud.import_export.impl.get_existing_import_chunk",
            MagicMock(side_effect=wrapped_get_existing_import_chunk),
        ) as get_existing_import_chunk_mock:
            import_uuid = str(uuid4().hex)

            with assume_test_silo_mode(SiloMode.CONTROL):
                import_chunk_count = ControlImportChunk.objects.count()
                ControlImportChunk.objects.create(
                    import_uuid=import_uuid,
                    model="sentry.controloption",
                    min_ordinal=1,
                    max_ordinal=1,
                    min_source_pk=9,
                    max_source_pk=9,
                    min_inserted_pk=123,
                    max_inserted_pk=123,
                    inserted_map={
                        "sentry.controloption": {
                            9: 123,
                        },
                    },
                )

            result = import_export_service.import_by_model(
                model_name="sentry.controloption",
                scope=RpcImportScope.Global,
                flags=RpcImportFlags(import_uuid=import_uuid),
                filter_by=[],
                pk_map=RpcPrimaryKeyMap(),
                json_data="""
                [
                    {
                        "model": "sentry.controloption",
                        "pk": 9,
                        "fields": {
                            "key": "foo",
                            "last_updated": "2023-06-22T00:00:00.000Z",
                            "last_updated_by": "unknown",
                            "value": "bar"
                        }
                    }
                ]
                """,
            )

            assert get_existing_import_chunk_mock.call_count == 2

            assert isinstance(result, RpcImportOk)
            assert result.min_ordinal == 1
            assert result.max_ordinal == 1
            assert result.min_source_pk == 9
            assert result.max_source_pk == 9
            assert result.min_inserted_pk == result.max_inserted_pk
            assert len(result.mapped_pks.from_rpc().mapping[str(CONTROL_OPTION_MODEL_NAME)]) == 1

            with assume_test_silo_mode(SiloMode.CONTROL):
                import_chunk = ControlImportChunk.objects.get(import_uuid=import_uuid)
                assert import_chunk.min_ordinal == 1
                assert import_chunk.max_ordinal == 1
                assert import_chunk.min_source_pk == 9
                assert import_chunk.max_source_pk == 9
                assert import_chunk.min_inserted_pk == import_chunk.max_inserted_pk
                assert len(import_chunk.inserted_map) == 1
                assert len(import_chunk.existing_map) == 0
                assert len(import_chunk.overwrite_map) == 0

                assert ControlImportChunk.objects.count() == import_chunk_count + 1


class RpcImportErrorTests(TestCase):
    """
    Validate errors related to the `import_by_model()` RPC method.
    """

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
            flags=RpcImportFlags(import_uuid=str(uuid4().hex)),
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            json_data="[]",
        )

        assert isinstance(result, RpcImportError)
        assert result.get_kind() == RpcImportErrorKind.UnknownModel

    @assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False)
    def test_bad_incorrect_silo_mode_for_model(self):
        result = import_export_service.import_by_model(
            model_name=str(PROJECT_MODEL_NAME),
            scope=RpcImportScope.Global,
            flags=RpcImportFlags(import_uuid=str(uuid4().hex)),
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            json_data="[]",
        )

        assert isinstance(result, RpcImportError)
        assert result.get_kind() == RpcImportErrorKind.IncorrectSiloModeForModel

    def test_bad_unspecified_scope(self):
        result = import_export_service.import_by_model(
            model_name=str(USER_MODEL_NAME),
            flags=RpcImportFlags(import_uuid=str(uuid4().hex)),
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            json_data="[]",
        )

        assert isinstance(result, RpcImportError)
        assert result.get_kind() == RpcImportErrorKind.UnspecifiedScope

    def test_bad_missing_import_uuid(self):
        result = import_export_service.import_by_model(
            model_name=str(USER_MODEL_NAME),
            scope=RpcImportScope.Global,
            flags=RpcImportFlags(),
            filter_by=[],
            pk_map=RpcPrimaryKeyMap(),
            json_data="[]",
        )

        assert isinstance(result, RpcImportError)
        assert result.get_kind() == RpcImportErrorKind.MissingImportUUID

    def test_bad_invalid_json(self):
        result = import_export_service.import_by_model(
            model_name=str(USER_MODEL_NAME),
            scope=RpcImportScope.Global,
            flags=RpcImportFlags(import_uuid=str(uuid4().hex)),
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
            flags=RpcImportFlags(import_uuid=str(uuid4().hex)),
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
            flags=RpcImportFlags(import_uuid=str(uuid4().hex)),
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
