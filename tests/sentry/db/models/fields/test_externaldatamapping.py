import pickle

import pytest
from django.core.validators import MaxLengthValidator
from django.db import connection, models
from django.db.migrations.autodetector import MigrationAutodetector
from django.db.migrations.graph import MigrationGraph
from django.db.migrations.state import ModelState, ProjectState

from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.db.models.fields.externaldatamapping import (
    ExternalDataMappingField,
    ExternalMappingType,
)


class ExternalDataMappingModel(models.Model):
    id = models.AutoField(primary_key=True)
    path = ExternalDataMappingField(
        models.TextField(null=True),
        mapping_type=ExternalMappingType.GCS,
        description="Direct path to the blob in GCS",
    )
    ext_id = ExternalDataMappingField(
        BoundedBigIntegerField(null=True),
        mapping_type=ExternalMappingType.POSTGRES,
        description="Implicit id of a row in another database",
    )
    redis_key = ExternalDataMappingField(
        models.CharField(max_length=32, null=True),
        mapping_type=ExternalMappingType.REDIS,
        description="Key of the matching redis entry",
    )
    plain = models.TextField(null=True)

    class Meta:
        app_label = "fixtures"


def _wrapped_text_field() -> ExternalDataMappingField:
    return ExternalDataMappingField(
        models.TextField(null=True),
        mapping_type=ExternalMappingType.GCS,
        description="Direct path to the blob in GCS",
    )


def test_constructor_rejections() -> None:
    with pytest.raises(TypeError, match="field instance"):
        ExternalDataMappingField(
            models.TextField,  # type: ignore[arg-type]
            mapping_type=ExternalMappingType.GCS,
            description="a class, not an instance",
        )
    with pytest.raises(TypeError, match="unsupported wrapped field type"):
        ExternalDataMappingField(
            models.DateTimeField(),
            mapping_type=ExternalMappingType.GCS,
            description="unsupported inner type",
        )
    with pytest.raises(TypeError, match="unsupported wrapped field type"):
        ExternalDataMappingField(
            models.ForeignKey("sentry.Project", on_delete=models.CASCADE),
            mapping_type=ExternalMappingType.POSTGRES,
            description="relations are explicit already",
        )
    with pytest.raises(TypeError, match="cannot be nested"):
        ExternalDataMappingField(
            _wrapped_text_field(),
            mapping_type=ExternalMappingType.GCS,
            description="nested wrapper",
        )
    bound_field = ExternalDataMappingModel._meta.get_field("plain")
    assert isinstance(bound_field, models.TextField)
    with pytest.raises(TypeError, match="already bound"):
        ExternalDataMappingField(
            bound_field,
            mapping_type=ExternalMappingType.GCS,
            description="already attached to a model",
        )
    with pytest.raises(TypeError, match="ExternalMappingType"):
        ExternalDataMappingField(
            models.TextField(null=True),
            mapping_type="gcs",  # type: ignore[arg-type]
            description="bare string instead of enum",
        )
    with pytest.raises(ValueError, match="non-empty description"):
        ExternalDataMappingField(
            models.TextField(null=True),
            mapping_type=ExternalMappingType.GCS,
            description="",
        )


@pytest.mark.parametrize(
    ("plain_factory", "expected_path"),
    (
        (lambda: models.TextField(null=True), "django.db.models.TextField"),
        (
            lambda: BoundedBigIntegerField(null=True),
            "sentry.db.models.fields.bounded.BoundedBigIntegerField",
        ),
        (lambda: models.CharField(max_length=32, null=True), "django.db.models.CharField"),
    ),
)
def test_deconstruct_masquerades(plain_factory, expected_path) -> None:
    plain = plain_factory()
    wrapped = ExternalDataMappingField(
        plain_factory(),
        mapping_type=ExternalMappingType.GCS,
        description="masquerade check",
    )
    assert wrapped.deconstruct()[1:] == plain.deconstruct()[1:]
    assert wrapped.deconstruct()[1] == expected_path


def _project_state(field: models.Field) -> ProjectState:
    state = ProjectState()
    state.add_model(
        ModelState(
            "fixtures",
            "AutodetectorModel",
            [("id", models.AutoField(primary_key=True)), ("path", field)],
        )
    )
    return state


def test_autodetector_zero_changes() -> None:
    before = _project_state(models.TextField(null=True))
    after = _project_state(_wrapped_text_field())
    assert MigrationAutodetector(before, after).changes(graph=MigrationGraph()) == {}
    # And unwrapping is equally invisible.
    before = _project_state(_wrapped_text_field())
    after = _project_state(models.TextField(null=True))
    assert MigrationAutodetector(before, after).changes(graph=MigrationGraph()) == {}


def test_model_state_from_model_roundtrip() -> None:
    state = ModelState.from_model(ExternalDataMappingModel)
    cloned = dict(state.fields)["path"]
    assert isinstance(cloned, ExternalDataMappingField)
    assert cloned.mapping_type == ExternalMappingType.GCS
    assert cloned.mapping_description == "Direct path to the blob in GCS"
    assert isinstance(cloned.wrapped_field, models.TextField)


def test_db_type_identical() -> None:
    pairs: tuple[tuple[models.Field, str], ...] = (
        (models.TextField(null=True), "path"),
        (BoundedBigIntegerField(null=True), "ext_id"),
        (models.CharField(max_length=32, null=True), "redis_key"),
    )
    for plain, attname in pairs:
        wrapped = ExternalDataMappingModel._meta.get_field(attname)
        assert isinstance(wrapped, ExternalDataMappingField)
        assert wrapped.db_type(connection) == plain.db_type(connection)
        assert wrapped.db_parameters(connection) == plain.db_parameters(connection)
        assert wrapped.get_internal_type() == plain.get_internal_type()


@pytest.mark.django_db
def test_runtime_round_trip() -> None:
    obj = ExternalDataMappingModel.objects.create(
        path="abc/123/blob", ext_id=42, redis_key="cache:1"
    )
    obj = ExternalDataMappingModel.objects.get(id=obj.id)
    assert obj.path == "abc/123/blob"
    assert obj.ext_id == 42
    assert obj.redis_key == "cache:1"

    assert ExternalDataMappingModel.objects.filter(path__contains="123").count() == 1
    assert ExternalDataMappingModel.objects.filter(ext_id__gte=42).count() == 1

    with connection.cursor() as cur:
        cur.execute(
            "select column_name, data_type, character_maximum_length "
            "from information_schema.columns "
            "where table_name = 'fixtures_externaldatamappingmodel'"
        )
        columns = {name: (data_type, max_length) for name, data_type, max_length in cur.fetchall()}
    assert columns["path"] == ("text", None)
    assert columns["ext_id"] == ("bigint", None)
    assert columns["redis_key"] == ("character varying", 32)


def test_wrapped_behavior_delegated() -> None:
    # BoundedBigIntegerField's bounds assertion fires through the wrapper.
    ext_id = ExternalDataMappingModel._meta.get_field("ext_id")
    assert isinstance(ext_id, ExternalDataMappingField)
    with pytest.raises(AssertionError):
        ext_id.get_prep_value(2**63)

    # CharField's instance-level MaxLengthValidator is visible through the wrapper.
    redis_key = ExternalDataMappingModel._meta.get_field("redis_key")
    assert isinstance(redis_key, ExternalDataMappingField)
    assert any(isinstance(v, MaxLengthValidator) for v in redis_key.validators)

    # Class-registered lookups resolve via the wrapped field's MRO.
    assert ext_id.get_lookup("gte") is BoundedBigIntegerField(null=True).get_lookup("gte")


def test_isinstance_introspection() -> None:
    annotated = {
        field.name: field
        for field in ExternalDataMappingModel._meta.get_fields()
        if isinstance(field, ExternalDataMappingField)
    }
    assert set(annotated) == {"path", "ext_id", "redis_key"}
    assert annotated["ext_id"].mapping_type == ExternalMappingType.POSTGRES
    assert annotated["ext_id"].mapping_description == "Implicit id of a row in another database"
    assert isinstance(annotated["ext_id"].wrapped_field, BoundedBigIntegerField)
    # Both the wrapper and the inner field are bound to the model attribute.
    assert annotated["path"].name == "path"
    assert annotated["path"].attname == "path"
    assert annotated["path"].column == "path"
    assert annotated["path"].wrapped_field.name == "path"
    assert annotated["path"].wrapped_field.column == "path"
    assert annotated["path"].wrapped_field.model is ExternalDataMappingModel


def test_system_checks_clean() -> None:
    for attname in ("path", "ext_id", "redis_key"):
        field = ExternalDataMappingModel._meta.get_field(attname)
        assert isinstance(field, ExternalDataMappingField)
        assert field.check() == []


def test_pickle_attached_field() -> None:
    field = ExternalDataMappingModel._meta.get_field("path")
    unpickled = pickle.loads(pickle.dumps(field))
    assert isinstance(unpickled, ExternalDataMappingField)
    assert unpickled.mapping_type == ExternalMappingType.GCS


def test_enum_values() -> None:
    assert ExternalMappingType.GCS == "gcs"
    assert ExternalMappingType.POSTGRES == "postgres"
    assert all(isinstance(member.value, str) for member in ExternalMappingType)
