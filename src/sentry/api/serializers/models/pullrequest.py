from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.release import get_users_for_authors
from sentry.models import CommitAuthor, PullRequest, Repository


def get_users_for_pull_requests(item_list, user=None):
    authors = list(
        CommitAuthor.objects.filter(id__in=[i.author_id for i in item_list if i.author_id])
    )

    if authors:
        org_ids = {item.organization_id for item in item_list}
        if len(org_ids) == 1:
            return get_users_for_authors(organization_id=org_ids.pop(), authors=authors, user=user)
    return {}


@register(PullRequest)
class PullRequestSerializer(Serializer):
    def get_attrs(self, item_list, user):
        users_by_author = get_users_for_pull_requests(item_list, user)
        repositories = list(Repository.objects.filter(id__in=[c.repository_id for c in item_list]))
        repository_map = {repository.id: repository for repository in repositories}
        serialized_repos = {r["id"]: r for r in serialize(repositories, user)}

        result = {}
        for item in item_list:
            repository_id = str(item.repository_id)
            external_url = ""
            if item.repository_id in repository_map:
                external_url = self._external_url(repository_map[item.repository_id], item)
            result[item] = {
                "repository": serialized_repos.get(repository_id, {}),
                "external_url": external_url,
                "user": users_by_author.get(str(item.author_id), {}) if item.author_id else {},
            }

        return result

    def _external_url(self, repository, pull):
        from sentry.plugins.base import bindings

        provider_id = repository.provider
        if not provider_id or not provider_id.startswith("integrations:"):
            return None
        provider_cls = bindings.get("integration-repository.provider").get(provider_id)
        provider = provider_cls(provider_id)
        return provider.pull_request_url(repository, pull)

    def serialize(self, obj, attrs, user):
        return {
            "id": obj.key,
            "title": obj.title,
            "message": obj.message,
            "dateCreated": obj.date_added,
            "repository": attrs["repository"],
            "author": attrs["user"],
            "externalUrl": attrs["external_url"],
        }
