from __future__ import absolute_import

from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize, EventAttachmentSerializer
from sentry.api.paginator import DateTimePaginator
from sentry.models import EventAttachment, Environment
from sentry.api.base import EnvironmentMixin


class GroupEventAttachmentSerializer(EventAttachmentSerializer):
    """
    Serializes event attachmens with event id for rendering in the group event
    attachments UI.
    """

    def serialize(self, obj, attrs, user):
        result = super(GroupEventAttachmentSerializer, self).serialize(obj, attrs, user)
        result["event_id"] = obj.event_id
        return result


class GroupAttachmentsEndpoint(GroupEndpoint, EnvironmentMixin):
    def get(self, request, group):
        """
        List Event Attachments
        ``````````````````````

        Returns a list of event attachments for an issue.

        :pparam string issue_id: the ID of the issue to retrieve.
        :pparam string key:      the tag key to look the values up for.
        :pparam list   types:    a list of attachment types to filter for.
        :auth: required
        """

        try:
            environment = self._get_environment_from_request(request, group.organization.id)
        except Environment.DoesNotExist:
            attachments = EventAttachment.objects.none()
        else:
            attachments = EventAttachment.objects.filter(group_id=group.id)
            if environment is not None:
                attachments = attachments.filter(environment=environment)

            types = request.GET.getlist("types") or ()
            if types:
                attachments = attachments.filter(file__type__in=types)

        return self.paginate(
            request=request,
            queryset=attachments,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user, GroupEventAttachmentSerializer()),
            paginator_cls=DateTimePaginator,
        )
