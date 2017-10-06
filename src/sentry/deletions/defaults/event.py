from __future__ import absolute_import, print_function

from sentry import nodestore

from ..base import (BaseDeletionTask, BaseRelation, ModelDeletionTask, ModelRelation)


class NodeDeletionTask(BaseDeletionTask):
    def __init__(self, manager, nodes, **kwargs):
        self.nodes = nodes
        super(NodeDeletionTask, self).__init__(manager, **kwargs)

    def chunk(self):
        nodestore.delete_multi(self.nodes)
        return False


class EventDeletionTask(ModelDeletionTask):
    def get_child_relations_bulk(self, instance_list):
        from sentry.models import EventTag

        node_ids = [i.data.id for i in instance_list]
        event_ids = [i.id for i in instance_list]

        return [
            BaseRelation({
                'nodes': node_ids
            }, NodeDeletionTask),
            ModelRelation(EventTag, {
                'event_id__in': event_ids,
            }, ModelDeletionTask),
        ]
