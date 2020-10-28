from __future__ import absolute_import, print_function

import logging
import re

from sentry.constants import ObjectStatus
from sentry.utils.query import bulk_delete_objects

_leaf_re = re.compile(r"^(UserReport|Event|Group)(.+)")


class BaseRelation(object):
    def __init__(self, params, task):
        self.task = task
        self.params = params

    def __repr__(self):
        return "<%s: task=%s params=%s>" % (type(self), self.task, self.params)


class ModelRelation(BaseRelation):
    def __init__(self, model, query, task=None, partition_key=None):
        params = {"model": model, "query": query}

        if partition_key:
            params["partition_key"] = partition_key

        super(ModelRelation, self).__init__(params=params, task=task)


class BaseDeletionTask(object):
    logger = logging.getLogger("sentry.deletions.async")

    DEFAULT_CHUNK_SIZE = 100

    def __init__(
        self, manager, skip_models=None, transaction_id=None, actor_id=None, chunk_size=None
    ):
        self.manager = manager
        self.skip_models = set(skip_models) if skip_models else None
        self.transaction_id = transaction_id
        self.actor_id = actor_id
        self.chunk_size = chunk_size if chunk_size is not None else self.DEFAULT_CHUNK_SIZE

    def __repr__(self):
        return "<%s: skip_models=%s transaction_id=%s actor_id=%s>" % (
            type(self),
            self.skip_models,
            self.transaction_id,
            self.actor_id,
        )

    def chunk(self):
        """
        Deletes a chunk of this instance's data. Return ``True`` if there is
        more work, or ``False`` if the entity has been removed.
        """
        raise NotImplementedError

    def get_child_relations(self, instance):
        # TODO(dcramer): it'd be nice if we collected the default relationships
        return [
            # ModelRelation(Model, {'parent_id': instance.id})
        ]

    def get_child_relations_bulk(self, instance_list):
        return [
            # ModelRelation(Model, {'parent_id__in': [i.id for id in instance_list]})
        ]

    def extend_relations(self, child_relations, obj):
        return child_relations

    def extend_relations_bulk(self, child_relations, obj_list):
        return child_relations

    def filter_relations(self, child_relations):
        if not self.skip_models or not child_relations:
            return child_relations

        return list(
            [rel for rel in child_relations if rel.params.get("model") not in self.skip_models]
        )

    def delete_bulk(self, instance_list):
        """
        Delete a batch of objects bound to this task.

        This **should** not be called with arbitrary types, but rather should
        be used for only the base type this task was instantiated against.
        """
        self.mark_deletion_in_progress(instance_list)

        child_relations = self.get_child_relations_bulk(instance_list)
        child_relations = self.extend_relations_bulk(child_relations, instance_list)
        child_relations = self.filter_relations(child_relations)
        if child_relations:
            has_more = self.delete_children(child_relations)
            if has_more:
                return has_more

        for instance in instance_list:
            child_relations = self.get_child_relations(instance)
            child_relations = self.extend_relations(child_relations, instance)
            child_relations = self.filter_relations(child_relations)
            if child_relations:
                has_more = self.delete_children(child_relations)
                if has_more:
                    return has_more

        return self.delete_instance_bulk(instance_list)

    def delete_instance(self, instance):
        raise NotImplementedError

    def delete_instance_bulk(self, instance_list):
        for instance in instance_list:
            self.delete_instance(instance)

    def delete_children(self, relations):
        # Ideally this runs through the deletion manager
        for relation in relations:
            task = self.manager.get(
                transaction_id=self.transaction_id,
                actor_id=self.actor_id,
                task=relation.task,
                **relation.params
            )
            has_more = True
            while has_more:
                has_more = task.chunk()
        return False

    def mark_deletion_in_progress(self, instance_list):
        pass


class ModelDeletionTask(BaseDeletionTask):
    DEFAULT_QUERY_LIMIT = None
    manager_name = "objects"

    def __init__(self, manager, model, query, query_limit=None, order_by=None, **kwargs):
        super(ModelDeletionTask, self).__init__(manager, **kwargs)
        self.model = model
        self.query = query
        self.query_limit = query_limit or self.DEFAULT_QUERY_LIMIT or self.chunk_size
        self.order_by = order_by

    def __repr__(self):
        return "<%s: model=%s query=%s order_by=%s transaction_id=%s actor_id=%s>" % (
            type(self),
            self.model,
            self.query,
            self.order_by,
            self.transaction_id,
            self.actor_id,
        )

    def extend_relations(self, child_relations, obj):
        from sentry.deletions import default_manager

        return child_relations + [rel(obj) for rel in default_manager.dependencies[self.model]]

    def extend_relations_bulk(self, child_relations, obj_list):
        from sentry.deletions import default_manager

        return child_relations + [
            rel(obj_list) for rel in default_manager.bulk_dependencies[self.model]
        ]

    def chunk(self, num_shards=None, shard_id=None):
        """
        Deletes a chunk of this instance's data. Return ``True`` if there is
        more work, or ``False`` if the entity has been removed.
        """
        query_limit = self.query_limit
        remaining = self.chunk_size
        while remaining > 0:
            queryset = getattr(self.model, self.manager_name).filter(**self.query)
            if self.order_by:
                queryset = queryset.order_by(self.order_by)

            if num_shards:
                assert num_shards > 1
                assert shard_id < num_shards
                queryset = queryset.extra(
                    where=[
                        u"id %% {num_shards} = {shard_id}".format(
                            num_shards=num_shards, shard_id=shard_id
                        )
                    ]
                )

            queryset = list(queryset[:query_limit])
            if not queryset:
                return False

            self.delete_bulk(queryset)
            remaining -= query_limit
        return True

    def delete_instance_bulk(self, instance_list):
        # slow, but ensures Django cascades are handled
        for instance in instance_list:
            self.delete_instance(instance)

    def delete_instance(self, instance):
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

    def get_actor(self):
        from sentry.models import User

        if self.actor_id:
            try:
                return User.objects.get_from_cache(id=self.actor_id)
            except User.DoesNotExist:
                pass
        return None

    def mark_deletion_in_progress(self, instance_list):
        for instance in instance_list:
            status = getattr(instance, "status", None)
            if status not in (ObjectStatus.DELETION_IN_PROGRESS, None):
                instance.update(status=ObjectStatus.DELETION_IN_PROGRESS)


class BulkModelDeletionTask(ModelDeletionTask):
    """
    An efficient mechanism for deleting larger volumes of rows in one pass,
    but will hard fail if the relations have resident foreign relations.

    Note: Does NOT support child relations.
    """

    DEFAULT_CHUNK_SIZE = 10000

    def __init__(self, manager, model, query, partition_key=None, **kwargs):
        super(BulkModelDeletionTask, self).__init__(manager, model, query, **kwargs)

        self.partition_key = partition_key

    def chunk(self):
        return self.delete_instance_bulk()

    def delete_instance_bulk(self):
        try:
            return bulk_delete_objects(
                model=self.model,
                limit=self.chunk_size,
                transaction_id=self.transaction_id,
                partition_key=self.partition_key,
                **self.query
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
                        **self.query
                    ),
                )
