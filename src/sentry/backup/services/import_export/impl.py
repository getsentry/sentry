# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import logging
import traceback

import sentry_sdk
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.serializers import deserialize, serialize
from django.core.serializers.base import DeserializationError
from django.db import DatabaseError, IntegrityError, connections, models, router, transaction
from django.db.models import Q
from django.forms import model_to_dict
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
from sentry.backup.helpers import EXCLUDED_APPS, DatetimeSafeDjangoJSONEncoder, Filter, ImportFlags
from sentry.backup.scopes import ExportScope
from sentry.backup.services.import_export.model import (
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
from sentry.backup.services.import_export.service import DEFAULT_IMPORT_FLAGS, ImportExportService
from sentry.db.models.base import BaseModel
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.importchunk import ControlImportChunk, RegionImportChunk
from sentry.models.organizationmember import OrganizationMember
from sentry.silo.base import SiloMode
from sentry.users.models.user import User
from sentry.users.models.userpermission import UserPermission
from sentry.users.models.userrole import UserRoleUser

logger = logging.getLogger(__name__)


def get_existing_import_chunk(
    model_name: NormalizedModelName,
    flags: ImportFlags,
    import_chunk_type: type[models.base.Model],
    min_ordinal: int,
) -> RpcImportOk | None:
    found_chunk = import_chunk_type.objects.filter(
        import_uuid=flags.import_uuid, model=model_name, min_ordinal=min_ordinal
    ).first()
    if found_chunk is None:
        return None

    found_data = model_to_dict(found_chunk)
    out_pk_map = PrimaryKeyMap()
    for old_pk, new_pk in found_data["inserted_map"].items():
        identifier = found_data["inserted_identifiers"].get(old_pk, None)
        out_pk_map.insert(model_name, int(old_pk), int(new_pk), ImportKind.Inserted, identifier)
    for old_pk, new_pk in found_data["existing_map"].items():
        out_pk_map.insert(model_name, int(old_pk), int(new_pk), ImportKind.Existing)
    for old_pk, new_pk in found_data["overwrite_map"].items():
        out_pk_map.insert(model_name, int(old_pk), int(new_pk), ImportKind.Overwrite)

    return RpcImportOk(
        mapped_pks=RpcPrimaryKeyMap.into_rpc(out_pk_map),
        min_ordinal=found_data["min_ordinal"],
        max_ordinal=found_data["max_ordinal"],
        min_source_pk=found_data["min_source_pk"],
        max_source_pk=found_data["max_source_pk"],
        min_inserted_pk=found_data["min_inserted_pk"],
        max_inserted_pk=found_data["max_inserted_pk"],
    )


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
        import_model_name: str = "",
        scope: RpcImportScope | None = None,
        flags: RpcImportFlags = DEFAULT_IMPORT_FLAGS,
        filter_by: list[RpcFilter],
        pk_map: RpcPrimaryKeyMap,
        json_data: str = "",
        min_ordinal: int,
    ) -> RpcImportResult:
        if min_ordinal < 1:
            return RpcImportError(
                kind=RpcImportErrorKind.InvalidMinOrdinal,
                on=InstanceID(import_model_name),
                reason=f"The model `{import_model_name}` was offset with an invalid `min_ordinal` of `{min_ordinal}`",
            )

        batch_model_name = NormalizedModelName(import_model_name)
        model = get_model(batch_model_name)
        if model is None:
            return RpcImportError(
                kind=RpcImportErrorKind.UnknownModel,
                on=InstanceID(import_model_name),
                reason=f"The model `{import_model_name}` could not be found",
            )

        silo_mode = SiloMode.get_current_mode()
        model_modes = model._meta.silo_limit.modes  # type: ignore[attr-defined]
        if silo_mode != SiloMode.MONOLITH and silo_mode not in model_modes:
            return RpcImportError(
                kind=RpcImportErrorKind.IncorrectSiloModeForModel,
                on=InstanceID(import_model_name),
                reason=f"The model `{import_model_name}` was forwarded to the incorrect silo (it cannot be imported from the {silo_mode} silo)",
            )

        if scope is None:
            return RpcImportError(
                kind=RpcImportErrorKind.UnspecifiedScope,
                on=InstanceID(import_model_name),
                reason="The RPC was called incorrectly, please set an `ImportScope` parameter",
            )

        import_flags = flags.from_rpc()
        if import_flags.import_uuid is None:
            return RpcImportError(
                kind=RpcImportErrorKind.MissingImportUUID,
                on=InstanceID(import_model_name),
                reason="Must specify `import_uuid` when importing",
            )

        import_scope = scope.from_rpc()
        in_pk_map = pk_map.from_rpc()
        filters: list[Filter] = []
        for fb in filter_by:
            if NormalizedModelName(fb.on_model) == batch_model_name:
                filters.append(fb.from_rpc())

        import_chunk_type = (
            ControlImportChunk
            if SiloMode.CONTROL in dependencies()[batch_model_name].silos
            else RegionImportChunk
        )

        extra = {
            "model_name": batch_model_name,
            "import_uuid": import_flags.import_uuid,
            "min_ordinal": min_ordinal,
        }

        try:
            # It's possible that this write has already occurred, and we are simply retrying
            # because the response got lost in transit. If so, just re-use that reply. We do
            # this in the transaction because, while `import_by_model` is generally called in a
            # sequential manner, cases like timeouts or long queues may cause a previous call to
            # still be active when the next one is made. We'll check once here for an existing
            # copy of this (uniquely identifiable) import chunk here to short circuit and avoid
            # doing frivolous work. However, this doesn't fully solve our data race error, as it
            # is possible that another runaway process makes the colliding write while we're
            # building our transaction. Thus, we'll check `get_existing_import_chunk()` again if
            # we catch an `IntegrityError` below.
            existing_import_chunk = get_existing_import_chunk(
                batch_model_name, import_flags, import_chunk_type, min_ordinal
            )
            if existing_import_chunk is not None:
                logger.info("import_by_model.already_imported", extra=extra)
                return existing_import_chunk

            # We don't need the control and region silo synced into the correct `*Replica` tables
            # immediately. The locally silo-ed versions of the models are written by the scripts
            # themselves, and the remote versions will be synced a few minutes later, well before
            # any users are likely ot need to get ahold of them to view actual data in the UI.
            using = router.db_for_write(model)
            # HACK(azaslavsky): Need to figure out why `OrganizationMemberTeam` in particular is failing, but we can just use async outboxes for it for now.
            with outbox_context(
                transaction.atomic(using=using),
                flush=import_model_name != "sentry.organizationmemberteam",
            ):
                ok_relocation_scopes = import_scope.value
                out_pk_map = PrimaryKeyMap()
                min_old_pk = 0
                max_old_pk = 0
                min_inserted_pk: int | None = None
                max_inserted_pk: int | None = None
                last_seen_ordinal = min_ordinal - 1
                for deserialized_object in deserialize(
                    "json", json_data, use_natural_keys=False, ignorenonexistent=True
                ):
                    model_instance = deserialized_object.object
                    inst_model_name = get_model_name(model_instance)

                    if not isinstance(model_instance, BaseModel):
                        return RpcImportError(
                            kind=RpcImportErrorKind.UnexpectedModel,
                            on=InstanceID(model=str(inst_model_name), ordinal=None),
                            left_pk=model_instance.pk,
                            reason=f"Received non-sentry model of kind `{inst_model_name}`",
                        )

                    if model_instance._meta.app_label not in EXCLUDED_APPS or model_instance:
                        if model_instance.get_possible_relocation_scopes() & ok_relocation_scopes:
                            if inst_model_name != batch_model_name:
                                return RpcImportError(
                                    kind=RpcImportErrorKind.UnexpectedModel,
                                    on=InstanceID(model=str(inst_model_name), ordinal=None),
                                    left_pk=model_instance.pk,
                                    reason=f"Received model of kind `{inst_model_name}` when `{batch_model_name}` was expected",
                                )

                            for f in filters:
                                if getattr(model_instance, f.field, None) not in f.values:
                                    break
                            else:
                                try:
                                    # We can only be sure `get_relocation_scope()` will be correct
                                    # if it is fired AFTER normalization, as some
                                    # `get_relocation_scope()` methods rely on being able to
                                    # correctly resolve foreign keys, which is only possible after
                                    # normalization.
                                    old_pk = model_instance.normalize_before_relocation_import(
                                        in_pk_map, import_scope, import_flags
                                    )
                                    if old_pk is None:
                                        continue

                                    # Now that the model has been normalized, we can ensure that
                                    # this particular instance has a `RelocationScope` that permits
                                    # importing.
                                    if (
                                        not model_instance.get_relocation_scope()
                                        in ok_relocation_scopes
                                    ):
                                        continue

                                    # Perform the actual database write.
                                    written = model_instance.write_relocation_import(
                                        import_scope, import_flags
                                    )
                                    if written is None:
                                        continue

                                    # For models that may have circular references to themselves
                                    # (unlikely), keep track of the new pk in the input map as well.
                                    last_seen_ordinal += 1
                                    new_pk, import_kind = written
                                    slug = getattr(model_instance, "slug", None)
                                    in_pk_map.insert(
                                        inst_model_name, old_pk, new_pk, import_kind, slug
                                    )
                                    out_pk_map.insert(
                                        inst_model_name, old_pk, new_pk, import_kind, slug
                                    )

                                    # Do a little bit of book-keeping for our future `ImportChunk`.
                                    if min_old_pk == 0:
                                        min_old_pk = old_pk
                                    if old_pk > max_old_pk:
                                        max_old_pk = old_pk
                                    if import_kind == ImportKind.Inserted:
                                        if min_inserted_pk is None:
                                            min_inserted_pk = new_pk
                                        if max_inserted_pk is None or new_pk > max_inserted_pk:
                                            max_inserted_pk = new_pk

                                except DjangoValidationError as e:
                                    errs = {field: error for field, error in e.message_dict.items()}
                                    return RpcImportError(
                                        kind=RpcImportErrorKind.ValidationError,
                                        on=InstanceID(import_model_name, ordinal=last_seen_ordinal),
                                        left_pk=model_instance.pk,
                                        reason=f"Django validation error encountered: {errs}",
                                    )

                                except DjangoRestFrameworkValidationError as e:
                                    return RpcImportError(
                                        kind=RpcImportErrorKind.ValidationError,
                                        on=InstanceID(import_model_name, ordinal=last_seen_ordinal),
                                        left_pk=model_instance.pk,
                                        reason=str(e),
                                    )

                # If the `last_seen_ordinal` has not been incremented, no actual writes were done.
                if last_seen_ordinal == min_ordinal - 1:
                    logger.info("import_by_model.none_imported", extra=extra)
                    return RpcImportOk(
                        mapped_pks=RpcPrimaryKeyMap.into_rpc(out_pk_map),
                        min_ordinal=None,
                        max_ordinal=None,
                        min_source_pk=None,
                        max_source_pk=None,
                        min_inserted_pk=None,
                        max_inserted_pk=None,
                    )

                # We wrote at least one model, so make sure to write an appropriate `ImportChunk`
                # and update the sequences too.
                table = model_instance._meta.db_table
                seq = f"{table}_id_seq"
                with connections[using].cursor() as cursor:
                    cursor.execute(f"SELECT setval(%s, (SELECT MAX(id) FROM {table}))", [seq])

                inserted = out_pk_map.partition({batch_model_name}, {ImportKind.Inserted}).mapping[
                    import_model_name
                ]
                existing = out_pk_map.partition({batch_model_name}, {ImportKind.Existing}).mapping[
                    import_model_name
                ]
                overwrite = out_pk_map.partition(
                    {batch_model_name}, {ImportKind.Overwrite}
                ).mapping[import_model_name]
                import_chunk_args = {
                    "import_uuid": flags.import_uuid,
                    "model": import_model_name,
                    "min_ordinal": min_ordinal,
                    "max_ordinal": last_seen_ordinal,
                    "min_source_pk": min_old_pk,
                    "max_source_pk": max_old_pk,
                    "min_inserted_pk": min_inserted_pk,
                    "max_inserted_pk": max_inserted_pk,
                    "inserted_map": {k: v[0] for k, v in inserted.items()},
                    "existing_map": {k: v[0] for k, v in existing.items()},
                    "overwrite_map": {k: v[0] for k, v in overwrite.items()},
                    "inserted_identifiers": {
                        k: v[2] for k, v in inserted.items() if v[2] is not None
                    },
                }
                if import_chunk_type == ControlImportChunk:
                    ControlImportChunk(**import_chunk_args).save()
                else:
                    # XXX: Monitors and Files are stored in non-default connections in saas.
                    with in_test_hide_transaction_boundary():
                        RegionImportChunk(**import_chunk_args).save()

                logger.info("import_by_model.successfully_imported", extra=extra)
                return RpcImportOk(
                    mapped_pks=RpcPrimaryKeyMap.into_rpc(out_pk_map),
                    min_ordinal=min_ordinal,
                    max_ordinal=last_seen_ordinal,
                    min_source_pk=min_old_pk,
                    max_source_pk=max_old_pk,
                    min_inserted_pk=min_inserted_pk,
                    max_inserted_pk=max_inserted_pk,
                )

        except DeserializationError as err:
            sentry_sdk.capture_exception()
            reason = str(err) or "No additional information"
            if err.__cause__:
                reason += f", {err.__cause__}"

            return RpcImportError(
                kind=RpcImportErrorKind.DeserializationFailed,
                on=InstanceID(import_model_name),
                reason=f"The submitted JSON could not be deserialized into Django model instances. {reason}",
            )

        except DatabaseError as e:
            # This race-detection code is a bit hacky, since it relies on string matching the error
            # description from postgres but... ¯\_(ツ)_/¯.
            if len(e.args) > 0:
                desc = str(e.args[0])

                # Any `UniqueViolation` indicates the possibility that we've lost a race. Check for
                # this explicitly by seeing if an `ImportChunk` with a matching unique signature has
                # been written to the database already.
                if desc.startswith("UniqueViolation"):
                    try:
                        existing_import_chunk = get_existing_import_chunk(
                            batch_model_name, import_flags, import_chunk_type, min_ordinal
                        )
                        if existing_import_chunk is not None:
                            logger.warning("import_by_model.lost_import_race", extra=extra)
                            return existing_import_chunk
                    except Exception:
                        sentry_sdk.capture_exception()
                        return RpcImportError(
                            kind=RpcImportErrorKind.Unknown,
                            on=InstanceID(import_model_name),
                            reason=f"Unknown internal error occurred: {traceback.format_exc()}",
                        )

            # All non-`ImportChunk`-related kinds of `IntegrityError` mean that the user's data was
            # not properly sanitized against collision. This could be the fault of either the import
            # logic, or the user's data itself.
            if isinstance(e, IntegrityError):
                sentry_sdk.capture_exception()
                return RpcImportError(
                    kind=RpcImportErrorKind.IntegrityError,
                    on=InstanceID(import_model_name),
                    reason=str(e),
                )

            sentry_sdk.capture_exception()
            return RpcImportError(
                kind=RpcImportErrorKind.DatabaseError,
                on=InstanceID(import_model_name),
                reason=str(e),
            )

        except Exception:
            sentry_sdk.capture_exception()
            return RpcImportError(
                kind=RpcImportErrorKind.Unknown,
                on=InstanceID(import_model_name),
                reason=f"Unknown internal error occurred: {traceback.format_exc()}",
            )

    def export_by_model(
        self,
        *,
        export_model_name: str = "",
        from_pk: int = 0,
        scope: RpcExportScope | None = None,
        filter_by: list[RpcFilter],
        pk_map: RpcPrimaryKeyMap,
        indent: int = 2,
    ) -> RpcExportResult:
        try:
            from sentry.db.models.base import BaseModel

            deps = dependencies()
            batch_model_name = NormalizedModelName(export_model_name)
            model = get_model(batch_model_name)
            if model is None or not issubclass(model, BaseModel):
                return RpcExportError(
                    kind=RpcExportErrorKind.UnknownModel,
                    on=InstanceID(export_model_name),
                    reason=f"The model `{export_model_name}` could not be found",
                )

            silo_mode = SiloMode.get_current_mode()
            model_modes = model._meta.silo_limit.modes  # type: ignore[attr-defined]
            if silo_mode != SiloMode.MONOLITH and silo_mode not in model_modes:
                return RpcExportError(
                    kind=RpcExportErrorKind.IncorrectSiloModeForModel,
                    on=InstanceID(export_model_name),
                    reason=f"The model `{export_model_name}` was forwarded to the incorrect silo (it cannot be exported from the {silo_mode} silo)",
                )

            if scope is None:
                return RpcExportError(
                    kind=RpcExportErrorKind.UnspecifiedScope,
                    on=InstanceID(export_model_name),
                    reason="The RPC was called incorrectly, please set an `ExportScope` parameter",
                )

            export_scope = scope.from_rpc()
            in_pk_map = pk_map.from_rpc()
            allowed_relocation_scopes = export_scope.value
            possible_relocation_scopes = model.get_possible_relocation_scopes()
            includable = possible_relocation_scopes & allowed_relocation_scopes
            if not includable:
                return RpcExportError(
                    kind=RpcExportErrorKind.UnexportableModel,
                    on=InstanceID(export_model_name),
                    reason=f"The model `{batch_model_name}` is not exportable",
                )

            max_pk = from_pk
            out_pk_map = PrimaryKeyMap()
            filters: list[Filter] = []
            for fb in filter_by:
                if NormalizedModelName(fb.on_model) == batch_model_name:
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

                            # Special case: We never want to filter on
                            # `OrganizationMember.inviter_id`, since the inviter could be the
                            # `user_id` of a `User` who is not in this `Organization`, and is
                            # therefore not being exported. There is probably a more generic and
                            # broadly applicable way to handle exceptional cases like this, but
                            # since it is a one off for now, it seems easiest to just handle it
                            # explicitly.
                            if model == OrganizationMember and field_id == "inviter_id":
                                continue

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
                            nonlocal max_pk
                            if item.pk > max_pk:
                                max_pk = item.pk

                            # For models that may have circular references to themselves (unlikely),
                            # keep track of the new pk in the input map as well.
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

                pk_name = model._meta.pk.name
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

        except Exception:
            sentry_sdk.capture_exception()
            return RpcExportError(
                kind=RpcExportErrorKind.Unknown,
                on=InstanceID(export_model_name),
                reason=f"Unknown internal error occurred: {traceback.format_exc()}",
            )

    def get_all_globally_privileged_users(self) -> set[int]:
        admin_user_pks: set[int] = set()
        admin_user_pks.update(
            User.objects.filter(Q(is_staff=True) | Q(is_superuser=True)).values_list(
                "id", flat=True
            )
        )
        admin_user_pks.update(UserPermission.objects.values_list("user_id", flat=True))
        admin_user_pks.update(UserRoleUser.objects.values_list("user_id", flat=True))
        return admin_user_pks
