from __future__ import absolute_import, print_function

from sentry import nodestore

from ..base import (BaseDeletionTask, BaseRelation, ModelDeletionTask)


class NodeDeletionTask(BaseDeletionTask):
    def __init__(self, manager, nodes, **kwargs):
        self.nodes = nodes
        super(NodeDeletionTask, self).__init__(manager, **kwargs)

    def chunk(self):
        nodestore.delete_multi(self.nodes)
        return False


class EventDeletionTask(ModelDeletionTask):
    def get_child_relations_bulk(self, instance_list):
        from sentry import models
        from sentry.deletions import default_manager

        node_ids = [i.data.id for i in instance_list]

        relations = [BaseRelation({'nodes': node_ids}, NodeDeletionTask)]
        relations.extend([rel(instance_list) for rel in default_manager.dependencies[models.Event]])

        return relations
