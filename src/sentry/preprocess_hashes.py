from __future__ import absolute_import


def get_raw_cache_key(project_id, event_id):
    return 'e:raw:{1}:{0}'.format(project_id, event_id)
