from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import TagKey, TagKeyStatus, TagValue
from sentry.utils.db import is_postgres


class ProjectTagKeyValuesEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS

    def get(self, request, project, key):
        """
        List a Tag's Values
        ```````````````````

        Return a list of values associated with this key.  The `query`
        parameter can be used to to perform a "starts with" match on
        values.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :pparam string key: the tag key to look up.
        :auth: required
        """
        if TagKey.is_reserved_key(key):
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

        base_queryset = TagValue.objects.filter(
            project=project,
            key=tagkey.key,
        )

        query = request.GET.get('query')
        if query:
            if is_postgres():
                # not quite optimal, but best we can do with ORM
                queryset = TagValue.objects.filter(
                    id__in=base_queryset.order_by('-times_seen')[:10000]
                )
            else:
                # MySQL can't handle an `IN` with a `LIMIT` clause
                queryset = base_queryset
            queryset = queryset.filter(value__contains=query)

        else:
            queryset = TagValue.objects.filter(
                project=project,
                key=tagkey.key,
            )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-times_seen',
            on_results=lambda x: serialize(x, request.user),
        )
