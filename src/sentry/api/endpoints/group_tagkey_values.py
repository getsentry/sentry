from __future__ import absolute_import

from sentry import tagstore
from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import DateTimePaginator, OffsetPaginator, Paginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.tagvalue import UserTagValueSerializer
from sentry.models import GroupTagValue, Group
from sentry.utils.apidocs import scenario


@scenario('ListTagValues')
def list_tag_values_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(
        method='GET',
        path='/issues/%s/tags/%s/values/' % (group.id, 'browser'),
    )


class GroupTagKeyValuesEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    # XXX: this scenario does not work for some inexplicable reasons
    # @attach_scenarios([list_tag_values_scenario])
    def get(self, request, group, key):
        """
        List a Tag's Values
        ```````````````````

        Return a list of values associated with this key for an issue.

        :pparam string issue_id: the ID of the issue to retrieve.
        :pparam string key: the tag key to look the values up for.
        :auth: required
        """
        lookup_key = tagstore.prefix_reserved_key(key)

        try:
            tagstore.get_tag_key(group.project_id, lookup_key)
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        queryset = GroupTagValue.objects.filter(
            group_id=group.id,
            key=lookup_key,
        )

        sort = request.GET.get('sort')
        if sort == 'date':
            order_by = '-last_seen'
            paginator_cls = DateTimePaginator
        elif sort == 'age':
            order_by = '-first_seen'
            paginator_cls = DateTimePaginator
        elif sort == 'freq':
            order_by = '-times_seen'
            paginator_cls = OffsetPaginator
        else:
            order_by = '-id'
            paginator_cls = Paginator

        if key == 'user':
            serializer_cls = UserTagValueSerializer()
        else:
            serializer_cls = None

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            paginator_cls=paginator_cls,
            on_results=lambda x: serialize(x, request.user, serializer_cls),
        )
