from sentry.api.bases.group import GroupEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.groupgithubactivity import GroupGithubActivity


class GroupGithubActivityEndpoint(GroupEndpoint):
    def get(self, request, group):
        github_feed = GroupGithubActivity.objects.filter(group_id=group.id).select_related("author")

        return self.paginate(
            request=request,
            queryset=github_feed,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
