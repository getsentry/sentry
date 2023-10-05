# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import List, Optional, Set

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.serializers import deserialize, serialize
from django.core.serializers.base import DeserializationError
from django.db import DatabaseError, IntegrityError, connections, router, transaction
from django.db.models import Q
from rest_framework.serializers import ValidationError as DjangoRestFrameworkValidationError

from sentry.backup.dependencies import (
    ImportKind,
    NormalizedModelName,
    PrimaryKeyMap,
    dependencies,
    get_model,
    get_model_name,
)
from sentry.backup.findings import InstanceID
from sentry.backup.helpers import EXCLUDED_APPS, DatetimeSafeDjangoJSONEncoder, Filter
from sentry.backup.scopes import ExportScope
from sentry.models.user import User
from sentry.models.userpermission import UserPermission
from sentry.models.userrole import UserRoleUser
from sentry.services.hybrid_cloud.import_export.model import (
    RpcExportError,
    RpcExportErrorKind,
    RpcExportOk,
    RpcExportResult,
    RpcExportScope,
    RpcFilter,
    RpcImportError,
    RpcImportErrorKind,
    RpcImportFlags,
    RpcImportOk,
    RpcImportResult,
    RpcImportScope,
    RpcPrimaryKeyMap,
)
from sentry.services.hybrid_cloud.import_export.service import ImportExportService
from sentry.silo.base import SiloMode


class UniversalImportExportService(ImportExportService):
    """
    This implementation is universal regardless of which mode (CONTROL, REGION, or MONOLITH) it is
    run in. All import/export codepaths must be executed in REGION or MONOLITH instances only, so
    the only case in which the caller should use the remote implementation are when trying to
    import/export a CONTROL model from a REGION instance. In such cases, it is up to the caller to
    manually select the correct remote/local instance based on the model being being
    imported/exported with a block of code like:

        if SiloMode.CONTROL in model._meta.silo_limit.modes:
            import_export_service.export_by_model(...)
        else:
            ImportExportService.get_local_implementation().export_by_model(...)
    """

    def import_by_model(
        self,
        *,
        model_name: str,
        scope: Optional[RpcImportScope] = None,
        flags: RpcImportFlags,
        filter_by: List[RpcFilter],
        pk_map: RpcPrimaryKeyMap,
        json_data: str,
    ) -> RpcImportResult:
        import_flags = flags.from_rpc()
        batch_model_name = NormalizedModelName(model_name)
        model = get_model(batch_model_name)
        if model is None:
            return RpcImportError(
                kind=RpcImportErrorKind.UnknownModel,
                on=InstanceID(model_name),
                reason=f"The model `{model_name}` could not be found",
            )

        silo_mode = SiloMode.get_current_mode()
        model_modes = model._meta.silo_limit.modes  # type: ignore
        if silo_mode != SiloMode.MONOLITH and silo_mode not in model_modes:
            return RpcImportError(
                kind=RpcImportErrorKind.IncorrectSiloModeForModel,
                on=InstanceID(model_name),
                reason=f"The model `{model_name}` was forwarded to the incorrect silo (it cannot be imported from the {silo_mode} silo)",
            )

        if scope is None:
            return RpcImportError(
                kind=RpcImportErrorKind.UnspecifiedScope,
                on=InstanceID(model_name),
                reason="The RPC was called incorrectly, please set an `ImportScope` parameter",
            )

        import_scope = scope.from_rpc()
        in_pk_map = pk_map.from_rpc()
        filters: List[Filter] = []
        for fb in filter_by:
            if NormalizedModelName(fb.model_name) == batch_model_name:
                filters.append(fb.from_rpc())

        try:
            using = router.db_for_write(model)
            with transaction.atomic(using=using):
                allowed_relocation_scopes = import_scope.value
                out_pk_map = PrimaryKeyMap()
                max_pk = 0
                counter = 0
                for obj in deserialize("json", json_data, use_natural_keys=False):
                    counter += 1
                    o = obj.object
                    if o._meta.app_label not in EXCLUDED_APPS or o:
                        if o.get_possible_relocation_scopes() & allowed_relocation_scopes:
                            o = obj.object
                            inst_model_name = get_model_name(o)
                            if inst_model_name != batch_model_name:
                                return RpcImportError(
                                    kind=RpcImportErrorKind.UnexpectedModel,
                                    on=InstanceID(model=str(inst_model_name), ordinal=1),
                                    left_pk=o.pk,
                                    reason=f"Received model of kind `{str(inst_model_name)}` when `{str(batch_model_name)}` was expected",
                                )

                            for f in filters:
                                if getattr(o, f.field, None) not in f.values:
                                    break
                            else:
                                try:
                                    # We can only be sure `get_relocation_scope()` will be correct
                                    # if it is fired AFTER normalization, as some
                                    # `get_relocation_scope()` methods rely on being able to
                                    # correctly resolve foreign keys, which is only possible after
                                    # normalization.
                                    old_pk = o.normalize_before_relocation_import(
                                        in_pk_map, import_scope, import_flags
                                    )
                                    if old_pk is None:
                                        continue

                                    # Now that the model has been normalized, we can ensure that
                                    # this particular instance has a `RelocationScope` that permits
                                    # importing.
                                    if not o.get_relocation_scope() in allowed_relocation_scopes:
                                        continue

                                    # Perform the actual database write.
                                    written = o.write_relocation_import(import_scope, import_flags)
                                    if written is None:
                                        continue

                                    # For models that may have circular references to themselves
                                    # (unlikely), keep track of the new pk in the input map as well.
                                    new_pk, import_kind = written
                                    slug = getattr(o, "slug", None)
                                    in_pk_map.insert(
                                        inst_model_name, old_pk, new_pk, import_kind, slug
                                    )
                                    out_pk_map.insert(
                                        inst_model_name, old_pk, new_pk, import_kind, slug
                                    )
                                    if new_pk > max_pk:
                                        max_pk = new_pk

                                except DjangoValidationError as e:
                                    errs = {field: error for field, error in e.message_dict.items()}
                                    return RpcImportError(
                                        kind=RpcImportErrorKind.ValidationError,
                                        on=InstanceID(model_name, ordinal=counter),
                                        left_pk=o.pk,
                                        reason=f"Django validation error encountered: {errs}",
                                    )

                                except DjangoRestFrameworkValidationError as e:
                                    return RpcImportError(
                                        kind=RpcImportErrorKind.ValidationError,
                                        on=InstanceID(model_name, ordinal=counter),
                                        left_pk=o.pk,
                                        reason=str(e),
                                    )

            # If we wrote at least one model, make sure to update the sequences too.
            if counter > 0:
                table = o._meta.db_table
                seq = f"{table}_id_seq"
                with connections[using].cursor() as cursor:
                    cursor.execute(f"SELECT setval(%s, (SELECT MAX(id) FROM {table}))", [seq])

            return RpcImportOk(
                mapped_pks=RpcPrimaryKeyMap.into_rpc(out_pk_map),
                max_pk=max_pk,
                num_imported=counter,
            )

        except DeserializationError:
            return RpcImportError(
                kind=RpcImportErrorKind.DeserializationFailed,
                on=InstanceID(model_name),
                reason="The submitted JSON could not be deserialized into Django model instances",
            )

        # Catch `IntegrityError` before `DatabaseError`, since the former is a subclass of the
        # latter.
        except IntegrityError as e:
            return RpcImportError(
                kind=RpcImportErrorKind.IntegrityError,
                on=InstanceID(model_name),
                reason=str(e),
            )

        except DatabaseError as e:
            return RpcImportError(
                kind=RpcImportErrorKind.DatabaseError,
                on=InstanceID(model_name),
                reason=str(e),
            )

        except Exception as e:
            return RpcImportError(
                kind=RpcImportErrorKind.Unknown,
                on=InstanceID(model_name),
                reason=f"Unknown internal error occurred: {e}",
            )

    def export_by_model(
        self,
        *,
        model_name: str = "",
        from_pk: int = 0,
        scope: Optional[RpcExportScope] = None,
        filter_by: List[RpcFilter],
        pk_map: RpcPrimaryKeyMap,
        indent: int = 2,
    ) -> RpcExportResult:
        try:
            from sentry.db.models.base import BaseModel

            deps = dependencies()
            batch_model_name = NormalizedModelName(model_name)
            model = get_model(batch_model_name)
            if model is None or not issubclass(model, BaseModel):
                return RpcExportError(
                    kind=RpcExportErrorKind.UnknownModel,
                    on=InstanceID(model_name),
                    reason=f"The model `{model_name}` could not be found",
                )

            silo_mode = SiloMode.get_current_mode()
            model_modes = model._meta.silo_limit.modes  # type: ignore
            if silo_mode != SiloMode.MONOLITH and silo_mode not in model_modes:
                return RpcExportError(
                    kind=RpcExportErrorKind.IncorrectSiloModeForModel,
                    on=InstanceID(model_name),
                    reason=f"The model `{model_name}` was forwarded to the incorrect silo (it cannot be exported from the {silo_mode} silo)",
                )

            if scope is None:
                return RpcExportError(
                    kind=RpcExportErrorKind.UnspecifiedScope,
                    on=InstanceID(model_name),
                    reason="The RPC was called incorrectly, please set an `ExportScope` parameter",
                )

            export_scope = scope.from_rpc()
            in_pk_map = pk_map.from_rpc()
            allowed_relocation_scopes = export_scope.value
            possible_relocation_scopes = model.get_possible_relocation_scopes()
            includable = possible_relocation_scopes & allowed_relocation_scopes
            if not includable or model._meta.proxy:
                return RpcExportError(
                    kind=RpcExportErrorKind.UnexportableModel,
                    on=InstanceID(model_name),
                    reason=f"The model `{str(batch_model_name)}` is not exportable",
                )

            max_pk = from_pk
            out_pk_map = PrimaryKeyMap()
            filters: List[Filter] = []
            for fb in filter_by:
                if NormalizedModelName(fb.model_name) == batch_model_name:
                    filters.append(fb.from_rpc())

            def filter_objects(queryset_iterator):
                # Intercept each value from the queryset iterator, ensure that it has the correct
                # relocation scope and that all of its dependencies have already been exported. If
                # they have, store it in the `pk_map`, and then yield it again. If they have not, we
                # know that some upstream model was filtered out, so we ignore this one as well.
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
                            if in_pk_map.get_pk(dependency_model_name, fk) is None:
                                # The foreign key value exists, but not found! An upstream model
                                # must have been filtered out, so we can filter this one out as
                                # well.
                                break
                        else:
                            # For models that may have circular references to themselves (unlikely),
                            # keep track of the new pk in the input map as well.
                            nonlocal max_pk
                            max_pk = item.pk
                            in_pk_map.insert(model_name, item.pk, item.pk, ImportKind.Inserted)
                            out_pk_map.insert(model_name, item.pk, item.pk, ImportKind.Inserted)
                            yield item

            def yield_objects():
                q = Q(pk__gt=from_pk)

                # Only do database query filtering if this is a non-global export. If it is a
                # global export, we want absolutely every relocatable model, so no need to
                # filter.
                if export_scope != ExportScope.Global:
                    # Create a Django filter from the relevant `filter_by` clauses.
                    query = dict()
                    for f in filters:
                        if f.model == model:
                            query[f.field + "__in"] = f.values
                    q &= Q(**query)
                    q = model.query_for_relocation_export(q, in_pk_map)

                pk_name = model._meta.pk.name  # type: ignore
                queryset = model._base_manager.filter(q).order_by(pk_name)
                return filter_objects(queryset.iterator())

            json_data = serialize(
                "json",
                yield_objects(),
                indent=indent,
                use_natural_foreign_keys=False,
                cls=DatetimeSafeDjangoJSONEncoder,
            )

            return RpcExportOk(
                mapped_pks=RpcPrimaryKeyMap.into_rpc(out_pk_map), max_pk=max_pk, json_data=json_data
            )

        except Exception as e:
            return RpcExportError(
                kind=RpcExportErrorKind.Unknown,
                on=InstanceID(model_name),
                reason=f"Unknown internal error occurred: {e}",
            )

    def get_all_globally_privileged_users(self) -> Set[int]:
        admin_user_pks: Set[int] = set()
        admin_user_pks.update(
            User.objects.filter(Q(is_staff=True) | Q(is_superuser=True)).values_list(
                "id", flat=True
            )
        )
        admin_user_pks.update(UserPermission.objects.values_list("user_id", flat=True))
        admin_user_pks.update(UserRoleUser.objects.values_list("user_id", flat=True))
        return admin_user_pks
