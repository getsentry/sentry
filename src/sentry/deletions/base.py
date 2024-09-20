from __future__ import annotations

import logging
import re
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Any, Generic, TypeVar

from sentry.constants import ObjectStatus
from sentry.db.models.base import Model
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.utils.query import bulk_delete_objects

_leaf_re = re.compile(r"^(UserReport|Event|Group)(.+)")


if TYPE_CHECKING:
    from sentry.deletions.manager import DeletionTaskManager


def _delete_children(
    manager: DeletionTaskManager,
    relations: Sequence[BaseRelation],
    transaction_id: str | None = None,
    actor_id: int | None = None,
) -> bool:
    # Ideally this runs through the deletion manager
    for relation in relations:
        task = manager.get(
            transaction_id=transaction_id,
            actor_id=actor_id,
            task=relation.task,
            **relation.params,
        )

        # If we want smaller tasks then this also has to return when has_more is true.
        # This could significant increase the number of tasks we spawn. Get better estimates
        # by collecting metrics.
        has_more = True
        while has_more:
            has_more = task.chunk()
            if has_more:
                metrics.incr("deletions.should_spawn", tags={"task": type(task).__name__})
    return False


class BaseRelation:
    def __init__(self, params: Mapping[str, Any], task: type[BaseDeletionTask[Any]] | None) -> None:
        self.task = task
        self.params = params

    def __repr__(self) -> str:
        class_type = type(self)
        return f"<{class_type.__module__}.{class_type.__name__}: task={self.task} params={self.params}>"


class ModelRelation(BaseRelation):
    def __init__(
        self,
        model: type[ModelT],
        query: Mapping[str, Any],
        task: type[BaseDeletionTask[Any]] | None = None,
        partition_key: str | None = None,
    ) -> None:
        params = {"model": model, "query": query}

        if partition_key:
            params["partition_key"] = partition_key

        super().__init__(params=params, task=task)


ModelT = TypeVar("ModelT", bound=Model)


class BaseDeletionTask(Generic[ModelT]):
    logger = logging.getLogger("sentry.deletions.async")

    DEFAULT_CHUNK_SIZE = 100

    def __init__(
        self,
        manager: DeletionTaskManager,
        skip_models: list[type[Model]] | None = None,
        transaction_id: str | None = None,
        actor_id: int | None = None,
        chunk_size: int | None = None,
    ):
        self.manager = manager
        self.skip_models = set(skip_models) if skip_models else None
        self.transaction_id = transaction_id
        self.actor_id = actor_id
        self.chunk_size = chunk_size if chunk_size is not None else self.DEFAULT_CHUNK_SIZE

    def __repr__(self) -> str:
        return "<{}: skip_models={} transaction_id={} actor_id={}>".format(
            type(self),
            self.skip_models,
            self.transaction_id,
            self.actor_id,
        )

    def chunk(self) -> bool:
        """
        Deletes a chunk of this instance's data. Return ``True`` if there is
        more work, or ``False`` if the entity has been removed.
        """
        raise NotImplementedError

    def should_proceed(self, instance: ModelT) -> bool:
        """
        Used by root tasks to ensure deletion is ok to proceed.
        This allows deletes to be undone by API endpoints without
        having to also update scheduled tasks.
        """
        return True

    def get_child_relations(self, instance: ModelT) -> list[BaseRelation]:
        # TODO(dcramer): it'd be nice if we collected the default relationships
        return [
            # ModelRelation(Model, {'parent_id': instance.id})
        ]

    def get_child_relations_bulk(self, instance_list: Sequence[ModelT]) -> list[BaseRelation]:
        return [
            # ModelRelation(Model, {'parent_id__in': [i.id for id in instance_list]})
        ]

    def filter_relations(self, child_relations: Sequence[BaseRelation]) -> list[BaseRelation]:
        if not self.skip_models or not child_relations:
            return list(child_relations)

        return list(
            rel for rel in child_relations if rel.params.get("model") not in self.skip_models
        )

    def delete_bulk(self, instance_list: Sequence[ModelT]) -> bool:
        """
        Delete a batch of objects bound to this task.

        This **should** not be called with arbitrary types, but rather should
        be used for only the base type this task was instantiated against.
        """
        self.mark_deletion_in_progress(instance_list)

        child_relations = self.get_child_relations_bulk(instance_list)
        child_relations = self.filter_relations(child_relations)
        if child_relations:
            has_more = self.delete_children(child_relations)
            if has_more:
                return has_more

        for instance in instance_list:
            child_relations = self.get_child_relations(instance)
            child_relations = self.filter_relations(child_relations)
            if child_relations:
                has_more = self.delete_children(child_relations)
                if has_more:
                    return has_more

        self.delete_instance_bulk(instance_list)

        return False

    def delete_instance(self, instance: ModelT) -> None:
        raise NotImplementedError

    def delete_instance_bulk(self, instance_list: Sequence[ModelT]) -> None:
        for instance in instance_list:
            self.delete_instance(instance)

    def delete_children(self, relations: list[BaseRelation]) -> bool:
        return _delete_children(self.manager, relations, self.transaction_id, self.actor_id)

    def mark_deletion_in_progress(self, instance_list: Sequence[ModelT]) -> None:
        pass


class ModelDeletionTask(BaseDeletionTask[ModelT]):
    DEFAULT_QUERY_LIMIT = None
    manager_name = "objects"

    def __init__(
        self,
        manager: DeletionTaskManager,
        model: type[ModelT],
        query: Mapping[str, Any],
        query_limit: int | None = None,
        order_by: str | None = None,
        **kwargs: Any,
    ):
        super().__init__(manager, **kwargs)
        self.model = model
        self.query = query
        self.query_limit = query_limit or self.DEFAULT_QUERY_LIMIT or self.chunk_size
        self.order_by = order_by

    def __repr__(self) -> str:
        return "<{}: model={} query={} order_by={} transaction_id={} actor_id={}>".format(
            type(self),
            self.model,
            self.query,
            self.order_by,
            self.transaction_id,
            self.actor_id,
        )

    def chunk(self) -> bool:
        """
        Deletes a chunk of this instance's data. Return ``True`` if there is
        more work, or ``False`` if all matching entities have been removed.
        """
        query_limit = self.query_limit
        remaining = self.chunk_size

        while remaining > 0:
            queryset = getattr(self.model, self.manager_name).filter(**self.query)
            if self.order_by:
                queryset = queryset.order_by(self.order_by)

            queryset = list(queryset[:query_limit])
            # If there are no more rows we are all done.
            if not queryset:
                return False

            self.delete_bulk(queryset)
            remaining = remaining - query_limit
        # We have more work to do as we didn't run out of rows to delete.
        return True

    def delete_instance(self, instance: ModelT) -> None:
        instance_id = instance.id
        try:
            instance.delete()
        finally:
            # Don't log Group and Event child object deletions.
            model_name = type(instance).__name__
            if not _leaf_re.search(model_name):
                self.logger.info(
                    "object.delete.executed",
                    extra={
                        "object_id": instance_id,
                        "transaction_id": self.transaction_id,
                        "app_label": instance._meta.app_label,
                        "model": model_name,
                    },
                )

    def get_actor(self) -> RpcUser | None:
        if self.actor_id:
            return user_service.get_user(user_id=self.actor_id)
        return None

    def mark_deletion_in_progress(self, instance_list: Sequence[ModelT]) -> None:
        for instance in instance_list:
            status = getattr(instance, "status", None)
            if status not in (ObjectStatus.DELETION_IN_PROGRESS, None):
                instance.update(status=ObjectStatus.DELETION_IN_PROGRESS)


class BulkModelDeletionTask(ModelDeletionTask[ModelT]):
    """
    An efficient mechanism for deleting larger volumes of rows in one pass,
    but will hard fail if the relations have resident foreign relations.

    Note: Does NOT support child relations.
    """

    DEFAULT_CHUNK_SIZE = 10000

    def __init__(
        self,
        manager: DeletionTaskManager,
        model: type[ModelT],
        query: Mapping[str, Any],
        partition_key: str | None = None,
        **kwargs: Any,
    ):
        super().__init__(manager, model, query, **kwargs)

        self.partition_key = partition_key

    def chunk(self) -> bool:
        return self._delete_instance_bulk()

    def _delete_instance_bulk(self) -> bool:
        try:
            return bulk_delete_objects(
                model=self.model,
                limit=self.chunk_size,
                transaction_id=self.transaction_id,
                partition_key=self.partition_key,
                **self.query,
            )
        finally:
            # Don't log Group and Event child object deletions.
            model_name = self.model.__name__
            if not _leaf_re.search(model_name):
                self.logger.info(
                    "object.delete.bulk_executed",
                    extra=dict(
                        {
                            "transaction_id": self.transaction_id,
                            "app_label": self.model._meta.app_label,
                            "model": model_name,
                        },
                        **self.query,
                    ),
                )
