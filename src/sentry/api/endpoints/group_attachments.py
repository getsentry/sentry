from sentry import features
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.group import GroupEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import EventAttachmentSerializer, serialize
from sentry.models import EventAttachment


class GroupEventAttachmentSerializer(EventAttachmentSerializer):
    """
    Serializes event attachments with event id for rendering in the group event
    attachments UI.
    """

    def serialize(self, obj, attrs, user):
        result = super().serialize(obj, attrs, user)
        result["event_id"] = obj.event_id
        return result


class GroupAttachmentsEndpoint(GroupEndpoint, EnvironmentMixin):
    def get(self, request, group):
        """
        List Event Attachments
        ``````````````````````

        Returns a list of event attachments for an issue.

        :pparam string issue_id: the ID of the issue to retrieve.
        :pparam list   types:    a list of attachment types to filter for.
        :auth: required
        """

        if not features.has(
            "organizations:event-attachments", group.project.organization, actor=request.user
        ):
            return self.respond(status=404)

        attachments = EventAttachment.objects.filter(group_id=group.id)

        types = request.GET.getlist("types") or ()
        if types:
            attachments = attachments.filter(type__in=types)

        return self.paginate(
            default_per_page=20,
            request=request,
            queryset=attachments,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user, GroupEventAttachmentSerializer()),
            paginator_cls=DateTimePaginator,
        )
