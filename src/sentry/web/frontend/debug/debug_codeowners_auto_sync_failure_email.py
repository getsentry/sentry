from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import Organization, OrganizationMember, Project, User
from sentry.notifications.notifications.codeowners_auto_sync import AutoSyncNotification

from .mail import render_preview_email_for_notification


class DebugCodeOwnersAutoSyncFailureView(View):
    def get(self, request: Request) -> Response:
        org = Organization(id=1, slug="petal", name="Petal")
        project = Project(id=1, slug="nodejs", name="Node.js", organization=org)
        user = User(name="Nisanthan", actor_id=1)
        OrganizationMember(organization=org, user_id=user.id, role="admin")
        notification = AutoSyncNotification(project)

        return render_preview_email_for_notification(notification, user)
