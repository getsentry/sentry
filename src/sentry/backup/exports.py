from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import NamedTuple

import click
from django.core.serializers import serialize
from django.core.serializers.json import DjangoJSONEncoder

from sentry.backup.dependencies import sorted_dependencies
from sentry.backup.scopes import RelocationScope

UTC_0 = timezone(timedelta(hours=0))


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


def exports(dest, old_config: OldExportConfig, indent: int, printer=click.echo):
    """Exports core data for the Sentry installation."""

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
                # TODO(getsentry/team-ospo#166): Make this check more precise once we pipe the
                # `scope` argument through.
                if getattr(model, "__relocation_scope__") != RelocationScope.Excluded:
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
