from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import Commit, CommitFileChange
from sentry.api.serializers.models.release import get_users_for_commits


@register(CommitFileChange)
class CommitFileChangeSerializer(Serializer):
    def get_attrs(self, item_list, user):
        commits = Commit.objects.filter(id__in=[f.commit_id for f in item_list]).select_related('author')
        author_objs = get_users_for_commits(commits)
        commits_by_id = {commit.id: commit for commit in commits}
        result = {}
        for item in item_list:
            result[item] = {
                'user': author_objs.get(commits_by_id[item.commit_id].author_id, {}),
                'message': commits_by_id[item.commit_id].message
            }

        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'org_id': obj.organization_id,
            'author': attrs.get('user', {}),
            'commit_message': attrs.get('message', ''),
            'filename': obj.filename,
            'type': obj.type
        }
