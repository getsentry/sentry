from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any, Literal

from django.db import models

from sentry.backup.dependencies import (
    ModelRelations,
    NormalizedModelName,
    dependencies,
    get_exportable_sentry_models,
    get_model_name,
    sorted_dependencies,
)
from sentry.backup.helpers import DatetimeSafeDjangoJSONEncoder


def verify_models_in_output(expected_models: list[type[models.Model]], actual_json: Any) -> None:
    """
    A helper context manager that checks that every model that a test "targeted" was actually seen
    in the output, ensuring that we're actually testing the thing we think we are. Additionally,
    this context manager is easily legible to static analysis, which allows for static checks to
    ensure that all `__relocation_scope__ != RelocationScope.Excluded` models are being tested.

    To be considered a proper "testing" of a given target type, the resulting output must contain at
    least one instance of that type with all of its fields present and set to non-default values.
    """

    # Do a quick scan to ensure that at least one instance of each expected model is present.
    actual_model_names = {entry["model"] for entry in actual_json}
    expected_model_types = {"sentry." + type.__name__.lower(): type for type in expected_models}
    expected_model_names = set(expected_model_types.keys())
    notfound = sorted(expected_model_names - actual_model_names)
    if len(notfound) > 0:
        raise AssertionError(
            f"""Some `expected_models` entries were not found: {notfound}

            If you are seeing this in CI, it means that this test produced an `export.json` backup
            file that was missing the above models. This check is in place to ensure that ALL models
            of a certain category are covered by this particular test - by omitting a certain kind
            of model from the backup output entirely, we end up in a situation where backing up the
            model in question to JSON is untested.

            To fix this, you'll need to modify the body of the test to add at least one of these
            models to the database before exporting. The process for doing so is test-specific, but
            if the test body contains a fixture factory like `self.create_exhaustive_...`, that
            function will be a good place to start. If it does not, you can just write the model to
            the database at the appropriate point in the test: `MyNewModel.objects.create(...)`.
            """
        )

    # Now do a more thorough check: for every `expected_models` entry, make sure that we have at
    # least one instance of that model that sets all of its fields to some non-default value.
    mistakes_by_model: dict[str, list[str]] = {}
    encoder = DatetimeSafeDjangoJSONEncoder()
    for model in actual_json:
        name = model["model"]
        if name not in expected_model_names:
            continue

        data = model["fields"]
        type = expected_model_types[name]
        fields = type._meta.get_fields()
        mistakes = []
        for f in fields:
            field_name = f.name

            # IDs are synonymous with primary keys, and should not be included in JSON field output.
            if field_name == "id":
                continue

            # The model gets a `ManyToOneRel` or `ManyToManyRel` from all other models where it is
            # referenced by foreign key. Those do not explicitly need to be set - we don't care that
            # models that reference this model exist, just that this model exists in its most
            # filled-out form.
            if isinstance(f, models.ManyToOneRel) or isinstance(f, models.ManyToManyRel):
                continue

            # TODO(getsentry/team-ospo#156): For some reason we currently don't always serialize
            # some `ManyToManyField`s with the `through` property set. I'll investigate, but will
            # skip over these for now.
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

        # If one model instance has N mistakes, and another has N - 1 mistakes, we want to keep the
        # shortest list, to give the user the smallest number of fixes to make when reporting the
        # mistake.
        if name not in mistakes_by_model or (len(mistakes) < len(mistakes_by_model[name])):
            mistakes_by_model[name] = mistakes

    for name, mistakes in mistakes_by_model.items():
        num = len(mistakes)
        if num > 0:
            raise AssertionError(f"Model {name} has {num} mistakes: {mistakes}")


def expect_models(group: set[NormalizedModelName], *marking: type | Literal["__all__"]) -> Callable:
    """
    A function that runs at module load time and marks all models that appear in a given test
    function. The first argument stores the tracked models in a global group, which we then check in
    `test_coverage.py` for completeness.

    Use the sentinel string "__all__" to indicate that all models are expected.
    """

    all: Literal["__all__"] = "__all__"
    target_models: set[type[models.Model]] = set()
    for model in marking:
        if model == all:
            all_models = get_exportable_sentry_models()
            group.update({get_model_name(c) for c in all_models})
            target_models = all_models.copy()
            break

        group.add(get_model_name(model))
        target_models.add(model)

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, target_models, **kwargs)

        return wrapper

    return decorator


def get_matching_exportable_models(
    matcher: Callable[[ModelRelations], bool] = lambda mr: True
) -> set[type[models.Model]]:
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
