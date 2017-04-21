from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Commit, Repository
from sentry.api.serializers.models.release import get_users_for_commits


@register(Commit)
class CommitSerializer(Serializer):
    def get_attrs(self, item_list, user):
        author_objs = get_users_for_commits(item_list)

        repositories = list(Repository.objects.filter(id__in=[c.repository_id for c in item_list]))
        repositories = serialize(repositories)
        repository_objs = {}
        for repository in repositories:
            repository_objs[repository['id']] = repository
        result = {}
        for item in item_list:
            result[item] = {
                'repository': repository_objs.get(six.text_type(item.repository_id), {}),
                'user': author_objs.get(item.author_id, {})
            }

        return result

    def serialize(self, obj, attrs, user):
        d = {
            'id': obj.key,
            'message': obj.message,
            'dateCreated': obj.date_added,
            'repository': attrs.get('repository', {}),
            'author': attrs.get('user', {})
        }

        return d
