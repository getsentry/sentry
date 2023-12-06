from __future__ import annotations

from typing import Callable, Literal, Type

from django.db import models

from sentry.backup.dependencies import (
    ModelRelations,
    NormalizedModelName,
    dependencies,
    get_model_name,
    sorted_dependencies,
)
from sentry.backup.helpers import DatetimeSafeDjangoJSONEncoder, get_exportable_sentry_models


def targets(expected_models: list[Type[models.Model]]):
    """A helper decorator that checks that every model that a test "targeted" was actually seen in
    the output, ensuring that we're actually testing the thing we think we are. Additionally, this
    decorator is easily legible to static analysis, which allows for static checks to ensure that
    all `__relocation_scope__ != RelocationScope.Excluded` models are being tested.

    To be considered a proper "testing" of a given target type, the resulting output must contain at
    least one instance of that type with all of its fields present and set to non-default values."""

    def decorator(func):
        def wrapped(*args, **kwargs):
            actual = func(*args, **kwargs)
            if actual is None:
                raise AssertionError(f"The test {func.__name__} did not return its actual JSON")

            # Do a quick scan to ensure that at least one instance of each expected model is
            # present.
            actual_model_names = {entry["model"] for entry in actual}
            expected_model_types = {
                "sentry." + type.__name__.lower(): type for type in expected_models
            }
            expected_model_names = set(expected_model_types.keys())
            notfound = sorted(expected_model_names - actual_model_names)
            if len(notfound) > 0:
                raise AssertionError(f"Some `@targets_models` entries were not found: {notfound}")

            # Now do a more thorough check: for every `expected_models` entry, make sure that we
            # have at least one instance of that model that sets all of its fields to some
            # non-default value.
            mistakes_by_model: dict[str, list[str]] = {}
            encoder = DatetimeSafeDjangoJSONEncoder()
            for model in actual:
                name = model["model"]
                if name not in expected_model_names:
                    continue

                data = model["fields"]
                type = expected_model_types[name]
                fields = type._meta.get_fields()
                mistakes = []
                for f in fields:
                    field_name = f.name

                    # IDs are synonymous with primary keys, and should not be included in JSON field
                    # output.
                    if field_name == "id":
                        continue

                    # The model gets a `ManyToOneRel` or `ManyToManyRel` from all other models where
                    # it is referenced by foreign key. Those do not explicitly need to be set - we
                    # don't care that models that reference this model exist, just that this model
                    # exists in its most filled-out form.
                    if isinstance(f, models.ManyToOneRel) or isinstance(f, models.ManyToManyRel):
                        continue

                    # TODO(getsentry/team-ospo#156): For some reason we currently don't always
                    # serialize some `ManyToManyField`s with the `through` property set. I'll
                    # investigate, but will skip over these for now.
                    if isinstance(f, models.ManyToManyField):
                        continue

                    if not isinstance(f, models.Field):
                        continue
                    if field_name not in data:
                        mistakes.append(f"Must include field: `{field_name}`")
                        continue
                    if f.has_default():
                        default_value = f.get_default()
                        serialized = encoder.encode(default_value)
                        if serialized == data:
                            mistakes.append(f"Must use non-default data: `{field_name}`")
                            return

                # If one model instance has N mistakes, and another has N - 1 mistakes, we want to
                # keep the shortest list, to give the user the smallest number of fixes to make when
                # reporting the mistake.
                if name not in mistakes_by_model or (len(mistakes) < len(mistakes_by_model[name])):
                    mistakes_by_model[name] = mistakes
            for name, mistakes in mistakes_by_model.items():
                num = len(mistakes)
                if num > 0:
                    raise AssertionError(f"Model {name} has {num} mistakes: {mistakes}")

            return None

        return wrapped

    return decorator


def mark(group: set[NormalizedModelName], *marking: Type | Literal["__all__"]):
    """
    A function that runs at module load time and marks all models that appear in a given test function.

    Use the sentinel string "__all__" to indicate that all models are expected.
    """

    all: Literal["__all__"] = "__all__"
    for model in marking:
        if model == all:
            all_models = get_exportable_sentry_models()
            group.update({get_model_name(c) for c in all_models})
            return list(all_models)

        group.add(get_model_name(model))
    return marking


def get_matching_exportable_models(
    matcher: Callable[[ModelRelations], bool] = lambda mr: True
) -> set[Type[models.Model]]:
    """
    Helper function that returns all of the model class definitions that return true for the provided matching function. Models will be iterated in the order specified by the `sorted_dependencies` function.
    """

    deps = dependencies()
    sorted = sorted_dependencies()
    matched = set()
    for model in sorted:
        if matcher(deps[get_model_name(model)]):
            matched.add(model)

    return matched
