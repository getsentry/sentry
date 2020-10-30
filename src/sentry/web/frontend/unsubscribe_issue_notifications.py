from __future__ import absolute_import

from django.http import Http404

from sentry.models import Group, GroupSubscription
from sentry.web.frontend.unsubscribe_notifications import UnsubscribeBaseView


class UnsubscribeIssueNotificationsView(UnsubscribeBaseView):
    object_type = "issue"

    def fetch_instance(self, issue_id):
        try:
            group = Group.objects.get_from_cache(id=issue_id)
        except Group.DoesNotExist:
            raise Http404
        return group

    def build_link(self, instance):
        return instance.get_absolute_url()

    def unsubscribe(self, instance, user):
        GroupSubscription.objects.create_or_update(
            group=instance, project=instance.project, user=user, values={"is_active": False}
        )
