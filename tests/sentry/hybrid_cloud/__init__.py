from typing import Set, Tuple, Type

from django.db.models import Model
from django.db.models.fields.related import RelatedField

from sentry.db.models.base import ModelSiloLimit
from sentry.silo import SiloMode


def _iter_models():
    from django.apps import apps

    for app, app_models in apps.all_models.items():
        for model in app_models.values():
            if (
                model.__module__.startswith("django.")
                or "tests." in model.__module__
                or "fixtures." in model.__module__
            ):
                continue
            yield model


def validate_models_have_silos(exemptions: Set[Type[Model]]):
    for model in _iter_models():
        if model in exemptions:
            continue
        if not isinstance(getattr(model._meta, "silo_limit", None), ModelSiloLimit):
            raise ValueError(
                f"{model!r} is missing a silo limit, add a silo_model decorate to indicate its placement"
            )
        if (
            SiloMode.REGION not in model._meta.silo_limit.modes
            and SiloMode.CONTROL not in model._meta.silo_limit.modes
        ):
            raise ValueError(
                f"{model!r} is marked as a pending model, but either needs a placement or an exemption in this test."
            )


def validate_no_cross_silo_foreign_keys(exemptions: Set[Tuple[Type[Model], Type[Model]]]):
    for model in _iter_models():
        validate_model_no_cross_silo_foreign_keys(model, exemptions)


def validate_relation_does_not_cross_silo_foreign_keys(
    model: Type[Model],
    related: Type[Model],
):
    for mode in model._meta.silo_limit.modes:
        if mode not in related._meta.silo_limit.modes:
            raise ValueError(
                f"{model!r} runs in {mode}, but is related to {related!r} which does not.  Add this relationship pair as an exception or drop the foreign key."
            )


def validate_model_no_cross_silo_foreign_keys(
    model: Type[Model],
    exemptions: Set[Tuple[Type[Model], Type[Model]]],
):
    for field in model._meta.fields:
        if isinstance(field, RelatedField):
            if (model, field.related_model) in exemptions:
                continue
            if (field.related_model, model) in exemptions:
                continue

            validate_relation_does_not_cross_silo_foreign_keys(model, field.related_model)
            validate_relation_does_not_cross_silo_foreign_keys(field.related_model, model)
