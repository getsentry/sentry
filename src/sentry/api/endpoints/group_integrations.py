from __future__ import absolute_import

from sentry import integrations
from sentry.api.bases import GroupEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.integration import IntegrationIssueSerializer
from sentry.integrations.base import IntegrationFeatures
from sentry.models import Integration


class GroupIntegrationsEndpoint(GroupEndpoint):
    def get(self, request, group):
        providers = [
            i.key for i in integrations.all() if i.has_feature(IntegrationFeatures.ISSUE_SYNC)
        ]
        return self.paginate(
            # TODO(jess): This should filter by integrations that
            # are configured for the group's project once that is supported
            queryset=Integration.objects.filter(
                organizations=group.organization,
                provider__in=providers,
            ),
            request=request,
            order_by='name',
            on_results=lambda x: serialize(x, request.user, IntegrationIssueSerializer(group)),
            paginator_cls=OffsetPaginator,
        )
