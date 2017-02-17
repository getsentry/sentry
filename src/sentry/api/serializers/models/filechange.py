from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import CommitFileChange
from sentry.api.serializers.models.release import get_users_for_commits


@register(CommitFileChange)
class CommitFileChangeSerializer(Serializer):
    def get_attrs(self, item_list, user):
        commits = [f.commit for f in item_list]
        author_objs = get_users_for_commits(commits)
        result = {}
        for item in item_list:
            result[item] = {
                'user': author_objs.get(item.commit.author_id, {})
            }

        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'org_id': obj.organization_id,
            'author': attrs.get('user', {}),
            'commit_message': obj.commit.message,
            'filename': obj.filename,
            'type': obj.type
        }
