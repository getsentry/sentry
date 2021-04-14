from collections import defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.release import CommitAuthor, get_users_for_authors
from sentry.models import Commit, Repository


def get_users_for_commits(item_list, user=None):
    authors = list(
        CommitAuthor.objects.get_many_from_cache([i.author_id for i in item_list if i.author_id])
    )

    if authors:
        org_ids = {item.organization_id for item in item_list}
        if len(org_ids) == 1:
            return get_users_for_authors(organization_id=org_ids.pop(), authors=authors, user=user)
    return {}


@register(Commit)
class CommitSerializer(Serializer):
    def __init__(self, exclude=None, include=None, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)
        self.exclude = frozenset(exclude if exclude else ())

    def get_attrs(self, item_list, user):
        if "author" not in self.exclude:
            users_by_author = get_users_for_commits(item_list, user)
        else:
            users_by_author = {}

        if "repository" not in self.exclude:
            repositories = serialize(
                list(Repository.objects.filter(id__in=[c.repository_id for c in item_list])), user
            )
        else:
            repositories = []

        repository_objs = {repository["id"]: repository for repository in repositories}

        result = {}
        for item in item_list:
            result[item] = {
                "repository": repository_objs.get(str(item.repository_id), {}),
                "user": users_by_author.get(str(item.author_id), {}) if item.author_id else {},
            }

        return result

    def serialize(self, obj, attrs, user):
        d = {"id": obj.key, "message": obj.message, "dateCreated": obj.date_added}
        if "repository" not in self.exclude:
            d["repository"] = attrs["repository"]
        if "author" not in self.exclude:
            d["author"] = attrs["user"]
        return d


@register(Commit)
class CommitWithReleaseSerializer(CommitSerializer):
    def __init__(self, exclude=None, include=None, *args, **kwargs):
        Serializer.__init__(self, *args, **kwargs)
        self.exclude = frozenset(exclude if exclude else ())

    def get_attrs(self, item_list, user):
        from sentry.models import ReleaseCommit

        attrs = super().get_attrs(item_list, user)
        releases_by_commit = defaultdict(list)
        queryset = ReleaseCommit.objects.filter(commit__in=item_list).select_related("release")[
            :1000
        ]
        for row in queryset:
            releases_by_commit[row.commit_id].append(row.release)
        for item in item_list:
            attrs[item]["releases"] = releases_by_commit[item.id]
        return attrs

    def serialize(self, obj, attrs, user):
        data = super().serialize(obj, attrs, user)
        data["releases"] = [
            {
                "version": r.version,
                "shortVersion": r.version,
                "ref": r.ref,
                "url": r.url,
                "dateReleased": r.date_released,
                "dateCreated": r.date_added,
            }
            for r in attrs["releases"]
        ]
        return data
