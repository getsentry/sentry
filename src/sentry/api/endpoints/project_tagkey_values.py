from __future__ import absolute_import

from sentry import tagstore
from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.models import Environment
from sentry.tagstore.types import TagValue


class ProjectTagKeyValuesEndpoint(ProjectEndpoint, EnvironmentMixin):
    doc_section = DocSection.PROJECTS

    def get(self, request, project, key):
        """
        List a Tag's Values
        ```````````````````

        Return a list of values associated with this key.  The `query`
        parameter can be used to to perform a "contains" match on
        values.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :pparam string key: the tag key to look up.
        :auth: required
        """
        lookup_key = tagstore.prefix_reserved_key(key)

        try:
            environment_id = self._get_environment_id_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            # if the environment doesn't exist then the tag can't possibly exist
            raise ResourceDoesNotExist

        try:
            tagkey = tagstore.get_tag_key(project.id, environment_id, lookup_key)
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        queryset = tagstore.get_tag_value_qs(
            project.id,
            environment_id,
            tagkey.key,
            query=request.GET.get('query'),
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-last_seen',
            paginator_cls=DateTimePaginator,
            on_results=lambda results: serialize(
                map(  # XXX: This is a pretty big abstraction leak
                    lambda instance: TagValue(
                        key=instance.key,
                        value=instance.value,
                        times_seen=instance.times_seen,
                        first_seen=instance.first_seen,
                        last_seen=instance.last_seen,
                    ),
                    results,
                ),
                request.user
            ),
        )
