from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import PullRequest, Repository, CommitAuthor
from sentry.api.serializers.models.release import get_users_for_authors


def get_users_for_pull_requests(item_list, user=None):
    authors = list(
        CommitAuthor.objects.filter(id__in=[i.author_id for i in item_list if i.author_id])
    )

    if authors:
        org_ids = set(item.organization_id for item in item_list)
        if len(org_ids) == 1:
            return get_users_for_authors(
                organization_id=org_ids.pop(),
                authors=authors,
                user=user,
            )
    return {}


@register(PullRequest)
class PullRequestSerializer(Serializer):
    def get_attrs(self, item_list, user):
        users_by_author = get_users_for_pull_requests(item_list, user)

        repositories = serialize(
            list(Repository.objects.filter(
                id__in=[c.repository_id for c in item_list],
            )), user
        )

        repository_objs = {repository['id']: repository for repository in repositories}

        result = {}
        for item in item_list:
            result[item] = {
                'repository': repository_objs.get(six.text_type(item.repository_id), {}),
                'user': users_by_author.get(six.text_type(item.author_id), {})
                if item.author_id else {},
            }

        return result

    def serialize(self, obj, attrs, user):
        d = {
            'id': obj.key,
            'title': obj.title,
            'message': obj.message,
            'dateCreated': obj.date_added,
            'repository': attrs['repository'],
            'author': attrs['user']
        }

        return d
