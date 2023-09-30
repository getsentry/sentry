from __future__ import annotations

from datetime import datetime, timedelta, timezone

import click
from django.core.serializers import serialize
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q

from sentry.backup.dependencies import (
    ImportKind,
    PrimaryKeyMap,
    dependencies,
    get_model_name,
    sorted_dependencies,
)
from sentry.backup.helpers import Filter
from sentry.backup.scopes import ExportScope

UTC_0 = timezone(timedelta(hours=0))

__all__ = (
    "DatetimeSafeDjangoJSONEncoder",
    "export_in_user_scope",
    "export_in_organization_scope",
    "export_in_config_scope",
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


def _export(
    dest,
    scope: ExportScope,
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
    from sentry.models.organization import Organization
    from sentry.models.organizationmember import OrganizationMember
    from sentry.models.user import User

    allowed_relocation_scopes = scope.value
    pk_map = PrimaryKeyMap()
    deps = dependencies()

    filters = []
    if filter_by is not None:
        filters.append(filter_by)
        if filter_by.model == Organization:
            if filter_by.field not in {"pk", "id", "slug"}:
                raise ValueError(
                    "Filter arguments must only apply to `Organization`'s `slug` field"
                )

            org_pks = set(
                Organization.objects.filter(slug__in=filter_by.values).values_list("id", flat=True)
            )
            user_pks = set(
                OrganizationMember.objects.filter(organization_id__in=org_pks).values_list(
                    "user_id", flat=True
                )
            )
            filters.append(Filter(User, "pk", set(user_pks)))
        elif filter_by.model == User:
            if filter_by.field not in {"pk", "id", "username"}:
                raise ValueError("Filter arguments must only apply to `User`'s `username` field")
        else:
            raise ValueError("Filter arguments must only apply to `Organization` or `User` models")

    def filter_objects(queryset_iterator):
        # Intercept each value from the queryset iterator, ensure that it has the correct relocation
        # scope and that all of its dependencies have already been exported. If they have, store it
        # in the `pk_map`, and then yield it again. If they have not, we know that some upstream
        # model was filtered out, so we ignore this one as well.
        for item in queryset_iterator:
            if not item.get_relocation_scope() in allowed_relocation_scopes:
                continue

            model = type(item)
            model_name = get_model_name(model)

            # Make sure this model is not explicitly being filtered.
            for f in filters:
                if f.model == model and getattr(item, f.field, None) not in f.values:
                    break
            else:
                # Now make sure its not transitively filtered either.
                for field, foreign_field in deps[model_name].foreign_keys.items():
                    dependency_model_name = get_model_name(foreign_field.model)
                    field_id = field if field.endswith("_id") else f"{field}_id"
                    fk = getattr(item, field_id, None)
                    if fk is None:
                        # Null deps are allowed.
                        continue
                    if pk_map.get_pk(dependency_model_name, fk) is None:
                        # The foreign key value exists, but not found! An upstream model must have
                        # been filtered out, so we can filter this one out as well.
                        break
                else:
                    pk_map.insert(model_name, item.pk, item.pk, ImportKind.Inserted)
                    yield item

    def yield_objects():
        from sentry.db.models.base import BaseModel

        # Collate the objects to be serialized.
        for model in sorted_dependencies():
            if not issubclass(model, BaseModel):
                continue

            possible_relocation_scopes = model.get_possible_relocation_scopes()
            includable = possible_relocation_scopes & allowed_relocation_scopes
            if not includable or model._meta.proxy:
                continue

            q = Q()

            # Only do database query filtering if this is a non-global export. If it is a global
            # export, we want absolutely every relocatable model, so no need to filter.
            if scope != ExportScope.Global:
                # Create a Django filter from the relevant `filter_by` clauses.
                query = dict()
                for f in filters:
                    if f.model == model:
                        query[f.field + "__in"] = f.values
                q &= Q(**query)
                q = model.query_for_relocation_export(q, pk_map)

            pk_name = model._meta.pk.name  # type: ignore
            queryset = model._base_manager.filter(q).order_by(pk_name)
            yield from filter_objects(queryset.iterator())

    serialize(
        "json",
        yield_objects(),
        indent=indent,
        stream=dest,
        use_natural_foreign_keys=False,
        cls=DatetimeSafeDjangoJSONEncoder,
    )


def export_in_user_scope(
    src, *, user_filter: set[str] | None = None, indent: int = 2, printer=click.echo
):
    """
    Perform an export in the `User` scope, meaning that only models with `RelocationScope.User` will
    be exported from the provided `src` file.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.user import User

    return _export(
        src,
        ExportScope.User,
        filter_by=Filter(User, "username", user_filter) if user_filter is not None else None,
        indent=indent,
        printer=printer,
    )


def export_in_organization_scope(
    src, *, org_filter: set[str] | None = None, indent: int = 2, printer=click.echo
):
    """
    Perform an export in the `Organization` scope, meaning that only models with
    `RelocationScope.User` or `RelocationScope.Organization` will be exported from the provided
    `src` file.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.organization import Organization

    return _export(
        src,
        ExportScope.Organization,
        filter_by=Filter(Organization, "slug", org_filter) if org_filter is not None else None,
        indent=indent,
        printer=printer,
    )


def export_in_config_scope(src, *, indent: int = 2, printer=click.echo):
    """
    Perform an export in the `Config` scope, meaning that only models directly related to the global
    configuration and administration of an entire Sentry instance will be exported.
    """

    # Import here to prevent circular module resolutions.
    from sentry.models.user import User
    from sentry.models.userpermission import UserPermission
    from sentry.models.userrole import UserRoleUser

    # Pick out all users with admin privileges.
    admin_user_pks: set[int] = set()
    admin_user_pks.update(
        User.objects.filter(Q(is_staff=True) | Q(is_superuser=True)).values_list("id", flat=True)
    )
    admin_user_pks.update(UserPermission.objects.values_list("user_id", flat=True))
    admin_user_pks.update(UserRoleUser.objects.values_list("user_id", flat=True))

    return _export(
        src,
        ExportScope.Config,
        filter_by=Filter(User, "pk", admin_user_pks),
        indent=indent,
        printer=printer,
    )


def export_in_global_scope(src, *, indent: int = 2, printer=click.echo):
    """
    Perform an export in the `Global` scope, meaning that all models will be exported from the
    provided source file.
    """
    return _export(src, ExportScope.Global, indent=indent, printer=printer)
