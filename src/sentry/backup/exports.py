from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import NamedTuple

import click
from django.core.serializers import serialize
from django.core.serializers.json import DjangoJSONEncoder

from sentry.backup.dependencies import sorted_dependencies
from sentry.backup.scopes import ExportScope

UTC_0 = timezone(timedelta(hours=0))

__all__ = (
    "DatetimeSafeDjangoJSONEncoder",
    "OldExportConfig",
    "export_in_user_scope",
    "export_in_organization_scope",
    "export_in_global_scope",
)


class DatetimeSafeDjangoJSONEncoder(DjangoJSONEncoder):
    """A wrapper around the default `DjangoJSONEncoder` that always retains milliseconds, even when
    their implicit value is `.000`. This is necessary because the ECMA-262 compatible
    `DjangoJSONEncoder` drops these by default."""

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.astimezone(UTC_0).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        return super().default(obj)


class OldExportConfig(NamedTuple):
    """While we are migrating to the new backup system, we need to take care not to break the old
    and relatively untested workflows. This model allows us to stub in the old configs."""

    # Do we include models that aren't in `sentry.*` databases, like the native Django ones (sites,
    # sessions, etc)?
    include_non_sentry_models: bool = False

    # A list of models to exclude from the export - eventually we want to deprecate and remove this
    # option.
    excluded_models: set[str] = set()

    # Old exports use "natural" foreign keys, which in practice only changes how foreign keys into
    # `sentry.User` are represented.
    use_natural_foreign_keys: bool = False


def _export(dest, scope: ExportScope, old_config: OldExportConfig, indent: int, printer=click.echo):
    """
    Exports core data for the Sentry installation.

    It is generally preferable to avoid calling this function directly, as there are certain combinations of input parameters that should not be used together. Instead, use one of the other wrapper functions in this file, named `export_in_XXX_scope()`.
    """

    allowed_relocation_scopes = scope.value

    def yield_objects():
        # Collate the objects to be serialized.
        for model in sorted_dependencies():
            # This is a bit confusing, but what it's saying is: any model that does not have
            # `__relocation_scope__` set MUST be a non-Sentry model (we check this both in init-time
            # testing and at runtime startup). We "deduce" a `RelocationScope` setting for this
            # non-Sentry model based on the config the user passed in: if they set
            # `old_config.include_non_sentry_models` to `True`, we set all deduced non-Sentry
            # relocation scopes to `Global`. Otherwise, we just exclude them.
            # print(f"Deduced rel scope for {model.__name__}: {inferred_relocation_scope.name}\n")
            includable = old_config.include_non_sentry_models
            if hasattr(model, "__relocation_scope__"):
                # TODO(getsentry/team-ospo#186): This won't be sufficient once we're trying to get
                # relocation scopes that may vary on a per-instance, rather than
                # per-model-definition, basis. We'll probably need to make use of something like
                # Django annotations to efficiently filter down models.
                if getattr(model, "__relocation_scope__") in allowed_relocation_scopes:
                    includable = True

            if (
                not includable
                or model.__name__.lower() in old_config.excluded_models
                or model._meta.proxy
            ):
                printer(f">> Skipping model <{model.__name__}>", err=True)
                continue

            queryset = model._base_manager.order_by(model._meta.pk.name)
            yield from queryset.iterator()

    printer(">> Beginning export", err=True)
    serialize(
        "json",
        yield_objects(),
        indent=indent,
        stream=dest,
        use_natural_foreign_keys=old_config.use_natural_foreign_keys,
        cls=DatetimeSafeDjangoJSONEncoder,
    )


def export_in_user_scope(src, printer=click.echo):
    """
    Perform an export in the `User` scope, meaning that only models with `RelocationScope.User` will be exported from the provided `src` file.
    """
    return _export(src, ExportScope.User, OldExportConfig(), 2, printer)


def export_in_organization_scope(src, printer=click.echo):
    """
    Perform an export in the `Organization` scope, meaning that only models with `RelocationScope.User` or `RelocationScope.Organization` will be exported from the provided `src` file.
    """
    return _export(src, ExportScope.Organization, OldExportConfig(), 2, printer)


def export_in_global_scope(src, printer=click.echo):
    """
    Perform an export in the `Global` scope, meaning that all models will be exported from the
    provided source file.
    """
    return _export(src, ExportScope.Global, OldExportConfig(), 2, printer)
