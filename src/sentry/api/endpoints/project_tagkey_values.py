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

        The ``query`` parameter can be used to to perform a "starts with" match
        on values.
        """
        if key in ('release', 'user', 'filename', 'function'):
            lookup_key = 'sentry:{0}'.format(key)
        else:
            lookup_key = key

        try:
            tagkey = TagKey.objects.get(
                project=project,
                key=lookup_key,
                status=TagKeyStatus.VISIBLE,
            )
        except TagKey.DoesNotExist:
            raise ResourceDoesNotExist

        queryset = TagValue.objects.filter(
            project=project,
            key=tagkey.key,
        )

        query = request.GET.get('query')
        if query:
            queryset = queryset.filter(value__istartswith=query)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-id',
            on_results=lambda x: serialize(x, request.user),
        )
