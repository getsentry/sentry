from __future__ import annotations

from django.db.models.fields.related import ManyToManyField

from sentry.backup.helpers import get_exportable_sentry_models, get_final_derivations_of
from sentry.db.models import BaseModel


# Note: this gets checked at runtime, but better to avoid possible runtime errors and catch it early
# in CI.
def test_all_final_derivations_of_django_model_set_included_in_export():
    missing = set(
        filter(
            lambda c: not hasattr(c, "__relocation_scope__"),
            get_final_derivations_of(BaseModel),
        )
    )
    assert not missing


def test_all_many_to_many_fields_explicitly_set_through_attribute():
    # Make sure we are visiting the field definitions correctly.
    visited = 0

    for model in get_exportable_sentry_models():
        many_to_many_fields = [
            field for field in model._meta.get_fields() if isinstance(field, ManyToManyField)
        ]
        for field in many_to_many_fields:
            if field.remote_field.through is not None and field.remote_field.through._meta:
                if field.remote_field.through._meta.auto_created:
                    raise AssertionError(
                        f"""{model!r} model has a `ManyToManyField` field, "{field.name}", that does not set an explicit `through=...` junction model."""
                    )
                else:
                    visited += 1

    assert visited > 0
