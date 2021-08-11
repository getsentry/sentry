from rest_framework.response import Response

from sentry.api.bases.group import GroupEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.groupgithubactivity import GroupGithubActivity


class GroupGithubActivityListEndpoint(GroupEndpoint):
    def get(self, request, group):
        github_feed = GroupGithubActivity.objects.filter(
            group_id=group.id,
        ).select_related("author")

        return self.paginate(
            request=request,
            queryset=github_feed,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )


class GroupGithubActivityEndpoint(GroupEndpoint):
    def put(self, request, group, activity_id):
        visible = request.data.get("visible")
        GroupGithubActivity.objects.filter(
            id=activity_id,
            group_id=group.id,
        ).update(visible=bool(visible))

        return Response(status=204)
