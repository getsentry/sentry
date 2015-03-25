from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import TagKey, TagKeyStatus, TagValue


class ProjectTagKeyValuesEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS

    def get(self, request, project, key):
        """
        List a tag's values

        Return a list of values associated with this key.

            {method} {path}

        """
        try:
            tagkey = TagKey.objects.get(
                project=project,
                key=key,
                status=TagKeyStatus.VISIBLE,
            )
        except TagKey.DoesNotExist:
            raise ResourceDoesNotExist

        queryset = TagValue.objects.filter(
            project=project,
            key=key,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-id',
            on_results=lambda x: serialize(x, request.user),
        )
