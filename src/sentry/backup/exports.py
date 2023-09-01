from __future__ import annotations

from datetime import datetime, timedelta, timezone

import click
from django.core.serializers import serialize
from django.core.serializers.json import DjangoJSONEncoder

from sentry.backup.dependencies import (
    PrimaryKeyMap,
    dependencies,
    normalize_model_name,
    sorted_dependencies,
)
from sentry.backup.helpers import Filter
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


class OldExportConfig:
    """While we are migrating to the new backup system, we need to take care not to break the old
    and relatively untested workflows. This model allows us to stub in the old configs."""

    # A list of models to exclude from the export - eventually we want to deprecate and remove this
    # option.
    excluded_models: set[str]

    # Do we include models that aren't in `sentry.*` databases, like the native Django ones (sites,
    # sessions, etc)?
    include_non_sentry_models: bool

    # Old exports use "natural" foreign keys, which in practice only changes how foreign keys into
    # `sentry.User` are represented.
    use_natural_foreign_keys: bool

    def __init__(
        self,
        *,
        excluded_models: set[str] | None = None,
        include_non_sentry_models: bool = False,
        use_natural_foreign_keys: bool = False,
    ):
        self.excluded_models = excluded_models if excluded_models is not None else set()
        self.include_non_sentry_models = include_non_sentry_models
        self.use_natural_foreign_keys = use_natural_foreign_keys


def _export(
    dest,
    scope: ExportScope,
    old_config: OldExportConfig,
    *,
    indent: int = 2,
    filter_by: Filter | None = None,
    printer=click.echo,
):
    """
    Exports core data for the Sentry installation.

    It is generally preferable to avoid calling this function directly, as there are certain combinations of input parameters that should not be used together. Instead, use one of the other wrapper functions in this file, named `export_in_XXX_scope()`.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.email import Email
    from sentry.models.organization import Organization
    from sentry.models.organizationmember import OrganizationMember
    from sentry.models.user import User
    from sentry.models.useremail import UserEmail

    allowed_relocation_scopes = scope.value
    pk_map = PrimaryKeyMap()
    deps = dependencies()

    filters = []
    if filter_by is not None:
        filters.append(filter_by)

        if filter_by.model == Organization:
            org_pks = [o.pk for o in Organization.objects.filter(slug__in=filter_by.values)]
            user_pks = [
                o.user_id
                for o in OrganizationMember.objects.filter(organization_id__in=set(org_pks))
            ]
            filters.append(Filter(User, "pk", set(user_pks)))
        elif filter_by.model == User:
            user_pks = [u.pk for u in User.objects.filter(username__in=filter_by.values)]
        else:
            raise TypeError("Filter arguments must only apply to `Organization` or `User` models")

        # `sentry.Email` models don't have any explicit dependencies on `User`, so we need to find
        # them manually via `UserEmail`.
        emails = [ue.email for ue in UserEmail.objects.filter(user__in=user_pks)]
        filters.append(Filter(Email, "email", set(emails)))

    def filter_objects(queryset_iterator):
        # Intercept each value from the queryset iterator and ensure that all of its dependencies
        # have already been exported. If they have, store it in the `pk_map`, and then yield it
        # again. If they have not, we know that some upstream model was filtered out, so we ignore
        # this one as well.
        for item in queryset_iterator:
            model = type(item)
            model_name = normalize_model_name(model)

            # Make sure this model is not explicitly being filtered.
            for f in filters:
                if f.model == model and getattr(item, f.field, None) not in f.values:
                    break
            else:
                # Now make sure its not transitively filtered either.
                for field, foreign_field in deps[model_name].foreign_keys.items():
                    dependency_model_name = normalize_model_name(foreign_field.model)
                    field_id = field if field.endswith("_id") else f"{field}_id"
                    fk = getattr(item, field_id, None)
                    if fk is None:
                        # Null deps are allowed.
                        continue
                    if pk_map.get(dependency_model_name, fk) is None:
                        # The foreign key value exists, but not found! An upstream model must have
                        # been filtered out, so we can filter this one out as well.
                        break
                else:
                    pk_map.insert(model_name, item.pk, item.pk)
                    yield item

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
            yield from filter_objects(queryset.iterator())

    printer(">> Beginning export", err=True)
    serialize(
        "json",
        yield_objects(),
        indent=indent,
        stream=dest,
        use_natural_foreign_keys=old_config.use_natural_foreign_keys,
        cls=DatetimeSafeDjangoJSONEncoder,
    )


def export_in_user_scope(src, *, user_filter: set[str] | None = None, printer=click.echo):
    """
    Perform an export in the `User` scope, meaning that only models with `RelocationScope.User` will be exported from the provided `src` file.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.user import User

    return _export(
        src,
        ExportScope.User,
        OldExportConfig(),
        filter_by=Filter(User, "username", user_filter) if user_filter is not None else None,
        printer=printer,
    )


def export_in_organization_scope(src, *, org_filter: set[str] | None = None, printer=click.echo):
    """
    Perform an export in the `Organization` scope, meaning that only models with `RelocationScope.User` or `RelocationScope.Organization` will be exported from the provided `src` file.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.organization import Organization

    return _export(
        src,
        ExportScope.Organization,
        OldExportConfig(),
        filter_by=Filter(Organization, "slug", org_filter) if org_filter is not None else None,
        printer=printer,
    )


def export_in_global_scope(src, *, printer=click.echo):
    """
    Perform an export in the `Global` scope, meaning that all models will be exported from the
    provided source file.
    """
    return _export(src, ExportScope.Global, OldExportConfig(), printer=printer)
