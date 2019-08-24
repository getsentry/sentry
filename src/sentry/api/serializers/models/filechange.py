from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import Commit, CommitFileChange, Repository
from sentry.api.serializers.models.commit import get_users_for_commits


@register(CommitFileChange)
class CommitFileChangeSerializer(Serializer):
    def get_attrs(self, item_list, user):
        commits = list(
            Commit.objects.filter(id__in=[f.commit_id for f in item_list]).select_related("author")
        )
        users_by_author = get_users_for_commits(commits)
        commits_by_id = {commit.id: commit for commit in commits}

        repo_names_by_id = dict(
            Repository.objects.filter(
                id__in=[commit.repository_id for commit in commits]
            ).values_list("id", "name")
        )

        result = {}
        for item in item_list:
            commit = commits_by_id[item.commit_id]
            result[item] = {
                "user": users_by_author.get(six.text_type(commit.author_id), {})
                if commit.author_id
                else {},
                "message": commit.message,
                "repository_name": repo_names_by_id.get(commit.repository_id),
            }

        return result

    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "orgId": obj.organization_id,
            "author": attrs.get("user", {}),
            "commitMessage": attrs.get("message", ""),
            "filename": obj.filename,
            "type": obj.type,
            "repoName": attrs.get("repository_name", ""),
        }
