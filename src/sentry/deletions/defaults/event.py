from __future__ import absolute_import, print_function

import six
from sentry import nodestore

from ..base import (BaseDeletionTask, BaseRelation, ModelRelation, ModelDeletionTask)


class NodeDeletionTask(BaseDeletionTask):
    def __init__(self, manager, nodes, **kwargs):
        self.nodes = nodes
        super(NodeDeletionTask, self).__init__(manager, **kwargs)

    def chunk(self):
        nodestore.delete_multi(self.nodes)
        return False


class EventDeletionTask(ModelDeletionTask):
    def get_child_relations_bulk(self, instance_list):
        node_ids = [i.data.id for i in instance_list]
        rv = [BaseRelation({'nodes': node_ids}, NodeDeletionTask)]

        by_project = {}
        for instance in instance_list:
            by_project.setdefault(instance.project_id, []).append(instance)

        for project_id, events in six.iteritems(by_project):
            rv.append(ModelRelation({'project_id': project_id,
                                     'event_id__in': [x.event_id for x in events]},
                                    ModelDeletionTask))

        return rv
