from __future__ import annotations

import contextlib
import logging
from typing import (
    TYPE_CHECKING,
    Any,
    Collection,
    Iterable,
    List,
    Mapping,
    Optional,
    Protocol,
    Tuple,
    Type,
    TypeVar,
)

from django.db import connections, router, transaction
from django.dispatch import receiver
from sentry_sdk.api import capture_exception

from sentry.db.models import BaseManager, Model
from sentry.signals import post_upgrade
from sentry.silo import SiloMode
from sentry.types.region import find_regions_for_orgs, find_regions_for_user
from sentry.utils.env import in_test_environment
from sentry.utils.snowflake import SnowflakeIdMixin

if TYPE_CHECKING:
    from sentry.models.outbox import ControlOutboxBase, OutboxCategory, RegionOutboxBase

logger = logging.getLogger("sentry.outboxes")


class RegionOutboxProducingModel(Model):
    """
    overrides model save, update, and delete methods such that, within an atomic transaction,
    an outbox returned from outbox_for_update is saved. Furthermore, using this mixin causes get_protected_operations
    to protect any updates/deletes/inserts of this model that do not go through the model methods (such as querysets
    or raw sql).  See `get_protected_operations` for info on working around this.

    Models that subclass from this or its descendents should consider using RegionOutboxProducingManager
    to support bulk operations that respect outbox creation.
    """

    class Meta:
        abstract = True

    default_flush: bool | None = None
    replication_version: int = 1

    @contextlib.contextmanager
    def prepare_outboxes(self, *, outbox_before_super: bool, flush: Optional[bool] = None):
        from sentry.models.outbox import outbox_context

        if flush is None:
            flush = self.default_flush

        with outbox_context(
            transaction.atomic(router.db_for_write(type(self))),
            flush=flush,
        ):
            if not outbox_before_super:
                yield
            self.outbox_for_update().save()
            if outbox_before_super:
                yield

    def save(self, *args: Any, **kwds: Any) -> None:
        with self.prepare_outboxes(outbox_before_super=False):
            super().save(*args, **kwds)

    def update(self, *args: Any, **kwds: Any) -> int:
        with self.prepare_outboxes(outbox_before_super=False):
            return super().update(*args, **kwds)

    def delete(self, *args: Any, **kwds: Any) -> Tuple[int, dict[str, Any]]:
        with self.prepare_outboxes(outbox_before_super=True, flush=False):
            return super().delete(*args, **kwds)

    def outbox_for_update(self, shard_identifier: int | None = None) -> RegionOutboxBase:
        raise NotImplementedError


_RM = TypeVar("_RM", bound=RegionOutboxProducingModel)


class RegionOutboxProducingManager(BaseManager[_RM]):
    """
    Provides bulk update and delete methods that respect outbox creation.
    """

    def bulk_create(self, objs: Iterable[_RM], *args: Any, **kwds: Any) -> Collection[_RM]:
        from sentry.models.outbox import outbox_context

        tuple_of_objs: Tuple[_RM, ...] = tuple(objs)
        if not tuple_of_objs:
            return super().bulk_create(tuple_of_objs, *args, **kwds)

        model: Type[_RM] = type(tuple_of_objs[0])
        using = router.db_for_write(model)

        assert not issubclass(
            model, SnowflakeIdMixin
        ), "bulk_create cannot work for SnowflakeIdMixin models!"
        with outbox_context(transaction.atomic(using=using), flush=False):
            with connections[using].cursor() as cursor:
                cursor.execute(
                    "SELECT nextval(%s) FROM generate_series(1,%s);",
                    [f"{model._meta.db_table}_id_seq", len(tuple_of_objs)],
                )
                ids = [i for i, in cursor.fetchall()]

            outboxes: List[RegionOutboxBase] = []
            for row_id, obj in zip(ids, tuple_of_objs):
                obj.id = row_id
                outboxes.append(obj.outbox_for_update())

            type(outboxes[0]).objects.bulk_create(outboxes)
            return super().bulk_create(tuple_of_objs, *args, **kwds)

    def bulk_update(self, objs: Iterable[_RM], fields: List[str], *args: Any, **kwds: Any) -> Any:
        from sentry.models.outbox import outbox_context

        tuple_of_objs: Tuple[_RM, ...] = tuple(objs)
        if not tuple_of_objs:
            return super().bulk_update(tuple_of_objs, fields, *args, **kwds)

        model: Type[_RM] = type(tuple_of_objs[0])
        using = router.db_for_write(model)
        with outbox_context(transaction.atomic(using=using), flush=False):
            outboxes: List[RegionOutboxBase] = []
            for obj in tuple_of_objs:
                outboxes.append(obj.outbox_for_update())

            type(outboxes[0]).objects.bulk_create(outboxes)
            return super().bulk_update(tuple_of_objs, fields, *args, **kwds)

    def bulk_delete(self, objs: Iterable[_RM]) -> Tuple[int, Mapping[str, int]]:
        from sentry.models.outbox import outbox_context

        tuple_of_objs: Tuple[_RM, ...] = tuple(objs)
        if not tuple_of_objs:
            return 0, {}

        model: Type[_RM] = type(tuple_of_objs[0])
        using = router.db_for_write(model)
        with outbox_context(transaction.atomic(using=using), flush=False):
            outboxes: List[RegionOutboxBase] = []
            for obj in tuple_of_objs:
                outboxes.append(obj.outbox_for_update())

            type(outboxes[0]).objects.bulk_create(outboxes)
            return self.filter(id__in={o.id for o in tuple_of_objs}).delete()


class ReplicatedRegionModel(RegionOutboxProducingModel):
    """
    An extension of RegionOutboxProducingModel that provides a default implementation for `outbox_for_update`
    based on the category and outbox type configured as class variables.  It also provides a default signal handler
    that invokes either of handle_async_replication or handle_async_deletion based on whether the object has
    been deleted or not.  Subclasses can and often should override these methods to configure outbox processing.

    Models that subclass from this or its descendents should consider using RegionOutboxProducingManager
    to support bulk operations that respect outbox creation.
    """

    category: OutboxCategory
    outbox_type: Type[RegionOutboxBase] | None = None

    class Meta:
        abstract = True

    def payload_for_update(self) -> Mapping[str, Any] | None:
        """
        A custom json payload to be included in outboxes generated via creation, update, or deletion.
        Note that outboxes are COALESCED!  This means that when multiple updates are processed at once,
        only the latest value is used and all others ignored.  That means that not every payload generated is
        guaranteed to be processed. It is recommended that outboxes that could be coalesced only contain
        data required to find the effected record from the database before making any RPC calls.
        """
        return None

    def outbox_for_update(self, shard_identifier: int | None = None) -> RegionOutboxBase:
        """
        Returns outboxes that result from this model's creation, update, or deletion.
        Subclasses generally should override payload_for_update to customize
        this behavior.
        """
        return self.category.as_region_outbox(
            model=self,
            payload=self.payload_for_update(),
            shard_identifier=shard_identifier,
            outbox=self.outbox_type,
        )

    @classmethod
    def handle_async_deletion(
        cls, identifier: int, shard_identifier: int, payload: Mapping[str, Any] | None
    ) -> None:
        """
        Called one or more times as an outbox receiver processes the class update category and the
        given identifier is not found in the database.  This method can be used to invoke service
        methods to destroy cross silo resources not already handled by HybridCloudForeignKey (those
        are handled via maybe_process_tombstone).  Note that this method can be called many times --
        for instance, failure to process the outbox will result in a retry.  Thus, all operations
        in this method must be entirely idempotent and safe to async / stale states that can occur.
        """
        pass

    def handle_async_replication(self, shard_identifier: int) -> None:
        """
        Called one or more times as an outbox receiver processes the class update category and
        the given identifier is found in the database.  This method can be used to invoke service
        methods to replicate, enable, or alter cross silo resources based on updates to this model.
        Note that because outboxes are COALESCED this means that not every unique update will be processed.
        Also keep in mind that any errors or failures will force a retry of processing, so be certain all
        operations are idempotent!
        """
        pass


class ControlOutboxProducingModel(Model):
    """
    An extension of RegionOutboxProducingModel that provides a default implementation for `outbox_for_update`
    based on the category nd outbox type configured as class variables.  Furthermore, using this mixin causes get_protected_operations
    to protect any updates/deletes/inserts of this model that do not go through the model methods (such as querysets
    or raw sql).  See `get_protected_operations` for info on working around this.

    Models that subclass from this or its descendents should consider using ControlOutboxProducingManager
    to support bulk operations that respect outbox creation.
    """

    default_flush: bool | None = None
    replication_version: int = 1

    class Meta:
        abstract = True

    @contextlib.contextmanager
    def _maybe_prepare_outboxes(self, *, outbox_before_super: bool):
        from sentry.models.outbox import outbox_context

        with outbox_context(
            transaction.atomic(router.db_for_write(type(self))),
            flush=self.default_flush,
        ):
            if not outbox_before_super:
                yield
            for outbox in self.outboxes_for_update():
                outbox.save()
            if outbox_before_super:
                yield

    def save(self, *args: Any, **kwds: Any) -> None:
        with self._maybe_prepare_outboxes(outbox_before_super=False):
            super().save(*args, **kwds)

    def update(self, *args: Any, **kwds: Any) -> int:
        with self._maybe_prepare_outboxes(outbox_before_super=False):
            return super().update(*args, **kwds)

    def delete(self, *args: Any, **kwds: Any) -> Tuple[int, dict[str, Any]]:
        with self._maybe_prepare_outboxes(outbox_before_super=True):
            return super().delete(*args, **kwds)

    def outboxes_for_update(self, shard_identifier: int | None = None) -> List[ControlOutboxBase]:
        raise NotImplementedError


_CM = TypeVar("_CM", bound=ControlOutboxProducingModel)


class ControlOutboxProducingManager(BaseManager[_CM]):
    """
    Provides bulk update and delete methods that respect outbox creation.
    """

    def bulk_create(self, objs: Iterable[_CM], *args: Any, **kwds: Any) -> Collection[_CM]:
        from sentry.models.outbox import outbox_context

        tuple_of_objs: Tuple[_CM, ...] = tuple(objs)
        if not tuple_of_objs:
            return super().bulk_create(tuple_of_objs, *args, **kwds)

        model: Type[_CM] = type(tuple_of_objs[0])
        using = router.db_for_write(model)

        assert not issubclass(
            model, SnowflakeIdMixin
        ), "bulk_create cannot work for SnowflakeIdMixin models!"

        with outbox_context(transaction.atomic(using=using), flush=False):
            with connections[using].cursor() as cursor:
                cursor.execute(
                    "SELECT nextval(%s) FROM generate_series(1,%s);",
                    [f"{model._meta.db_table}_id_seq", len(tuple_of_objs)],
                )
                ids = [i for i, in cursor.fetchall()]

            outboxes: List[ControlOutboxBase] = []
            for row_id, obj in zip(ids, tuple_of_objs):
                obj.id = row_id
                outboxes.extend(obj.outboxes_for_update())

            type(outboxes[0]).objects.bulk_create(outboxes)
            return super().bulk_create(tuple_of_objs, *args, **kwds)

    def bulk_update(self, objs: Iterable[_CM], fields: List[str], *args: Any, **kwds: Any) -> Any:
        from sentry.models.outbox import outbox_context

        tuple_of_objs: Tuple[_CM, ...] = tuple(objs)
        if not tuple_of_objs:
            return super().bulk_update(tuple_of_objs, fields, *args, **kwds)

        model: Type[_CM] = type(tuple_of_objs[0])
        using = router.db_for_write(model)
        with outbox_context(transaction.atomic(using=using), flush=False):
            outboxes: List[ControlOutboxBase] = []
            for obj in tuple_of_objs:
                outboxes.extend(obj.outboxes_for_update())

            type(outboxes[0]).objects.bulk_create(outboxes)
            return super().bulk_update(tuple_of_objs, fields, *args, **kwds)

    def bulk_delete(self, objs: Iterable[_CM]) -> Tuple[int, Mapping[str, int]]:
        from sentry.models.outbox import outbox_context

        tuple_of_objs: Tuple[_CM, ...] = tuple(objs)
        if not tuple_of_objs:
            return 0, {}

        model: Type[_CM] = type(tuple_of_objs[0])
        using = router.db_for_write(model)
        with outbox_context(transaction.atomic(using=using), flush=False):
            outboxes: List[ControlOutboxBase] = []
            for obj in tuple_of_objs:
                outboxes.extend(obj.outboxes_for_update())

            type(outboxes[0]).objects.bulk_create(outboxes)
            return self.filter(id__in={o.id for o in tuple_of_objs}).delete()


class ReplicatedControlModel(ControlOutboxProducingModel):
    """
    An extension of RegionOutboxProducingModel that provides a default implementation for `outboxes_for_update`
    based on the category nd outbox type configured as class variables.  It also provides a default signal handler
    that invokes either of handle_async_replication or handle_async_deletion based on wether the object has
    been deleted or not.  Subclasses can and often should override these methods to configure outbox processing.

    Models that subclass from this or its descendents should consider using ControlOutboxProducingManager
    to support bulk operations that respect outbox creation.
    """

    category: OutboxCategory
    outbox_type: Type[ControlOutboxBase] | None = None

    class Meta:
        abstract = True

    def outbox_region_names(self) -> Collection[str]:
        """
        Subclasses should override this with logic for inferring the regions that need to be contacted for this resource.
        """
        if hasattr(self, "organization_id"):
            return find_regions_for_orgs([self.organization_id])
        if hasattr(self, "user_id"):
            return find_regions_for_user(self.user_id)
        # Note that a default implementation for user_id is NOT given, because handling the case where a user
        # joins a new organization after the last outbox was processed is a special case that requires special handling.
        raise NotImplementedError

    def payload_for_update(self) -> Mapping[str, Any] | None:
        """
        A custom json payload to be included in outboxes generated via creation, update, or deletion.
        Note that outboxes are COALESCED!  This means that when multiple updates are processed at once,
        only the latest value is used and all others ignored.  That means that not every payload generated is
        guaranteed to be processed.
        """
        return None

    def outboxes_for_update(self, shard_identifier: int | None = None) -> List[ControlOutboxBase]:
        """
        Returns outboxes that result from this model's creation, update, or deletion.
        Subclasses generally should override outbox_region_names or payload_for_update to customize
        this behavior.
        """
        return self.category.as_control_outboxes(
            region_names=self.outbox_region_names(),
            model=self,
            payload=self.payload_for_update(),
            shard_identifier=shard_identifier,
            outbox=self.outbox_type,
        )

    @classmethod
    def handle_async_deletion(
        cls,
        identifier: int,
        region_name: str,
        shard_identifier: int,
        payload: Mapping[str, Any] | None,
    ) -> None:
        """
        Called one or more times as an outbox receiver processes the class update category and the
        given identifier is not found in the database.  This method can be used to invoke service
        methods to destroy cross silo resources not already handled by HybridCloudForeignKey (those
        are handled via maybe_process_tombstone).  Note that this method can be called many times --
        for instance, failure to process the outbox will result in a retry.  Thus, all operations
        in this method must be entirely idempotent and safe to async / stale states that can occur.
        """
        pass

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        """
        Called one or more times as an outbox receiver processes the class update category and
        the given identifier is found in the database.  This method can be used to invoke service
        methods to replicate, enable, or alter cross silo resources based on updates to this model.
        Note that because outboxes are COALESCED this means that not every unique update will be processed.
        Also keep in mind that any errors or failures will force a retry of processing, so be certain all
        operations are idempotent!
        """
        pass


class HasControlReplicationHandlers(Protocol):
    """
    Helps cover the interface of ReplicatedControlModel and User (which cannot subclass) that allows them
    to use OutboxCategory.connect_control_model_updates.
    """

    @classmethod
    def handle_async_deletion(
        cls,
        identifier: int,
        region_name: str,
        shard_identifier: int,
        payload: Mapping[str, Any] | None,
    ) -> None:
        pass

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        pass


@receiver(post_upgrade)
def run_outbox_replications_for_self_hosted(*args: Any, **kwds: Any):
    from django.conf import settings

    from sentry.models.outbox import OutboxBase
    from sentry.tasks.backfill_outboxes import backfill_outboxes_for

    if not settings.SENTRY_SELF_HOSTED:
        return

    logger.info("Executing outbox replication backfill")
    while backfill_outboxes_for(
        SiloMode.get_current_mode(), max_batch_rate=1000, force_synchronous=True
    ):
        pass

    for outbox_name in (name for names in settings.SENTRY_OUTBOX_MODELS.values() for name in names):
        logger.info("Processing %ss...", outbox_name)
        outbox_model: Type[OutboxBase] = OutboxBase.from_outbox_name(outbox_name)
        for shard_attrs in outbox_model.find_scheduled_shards():
            next_outbox: OutboxBase | None = outbox_model.prepare_next_from_shard(shard_attrs)
            if next_outbox is None:
                continue
            try:
                next_outbox.drain_shard(flush_all=True)
            except Exception:
                capture_exception()
                if in_test_environment():
                    raise

    logger.info("done")
