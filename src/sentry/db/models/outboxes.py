from __future__ import annotations

import contextlib
import logging
from typing import TYPE_CHECKING, Any, Collection, List, Mapping, Optional, Tuple, Type

from django.db import router, transaction
from django.dispatch import receiver
from sentry_sdk.api import capture_exception

from sentry.db.models import Model
from sentry.signals import post_upgrade
from sentry.silo import SiloMode
from sentry.types.region import find_regions_for_orgs
from sentry.utils.env import in_test_environment

if TYPE_CHECKING:
    from sentry.models.outbox import ControlOutboxBase, OutboxCategory, RegionOutboxBase

logger = logging.getLogger("sentry.outboxes")


class RegionOutboxProducingModel(Model):
    """
    overrides model save, update, and delete methods such that, within an atomic transaction,
    an outbox returned from outbox_for_update is saved. Furthermore, using this mixin causes get_protected_operations
    to protect any updates/deletes/inserts of this model that do not go through the model methods (such as querysets
    or raw sql).  See `get_protected_operations` for info on working around this.
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


class ReplicatedRegionModel(RegionOutboxProducingModel):
    """
    An extension of RegionOutboxProducingModel that provides a default implementation for `outbox_for_update`
    based on the category and outbox type configured as class variables.  It also provides a default signal handler
    that invokes either of handle_async_replication or handle_async_replication based on whether the object has
    been deleted or not.  Subclasses can and often should override these methods to configure outbox processing.
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


class ReplicatedControlModel(ControlOutboxProducingModel):
    """
    An extension of RegionOutboxProducingModel that provides a default implementation for `outboxes_for_update`
    based on the category nd outbox type configured as class variables.  It also provides a default signal handler
    that invokes either of handle_async_replication or handle_async_replication based on wether the object has
    been deleted or not.  Subclasses can and often should override these methods to configure outbox processing.
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
        logger.info(f"Processing {outbox_name}s...")
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
