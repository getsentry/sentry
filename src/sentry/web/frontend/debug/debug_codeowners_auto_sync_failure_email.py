from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.user import User
from sentry.notifications.notifications.codeowners_auto_sync import AutoSyncNotification

from .mail import render_preview_email_for_notification


class DebugCodeOwnersAutoSyncFailureView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        org = Organization(id=1, slug="petal", name="Petal")
        project = Project(id=1, slug="nodejs", name="Node.js", organization=org)
        user = User(name="Nisanthan")
        OrganizationMember(organization=org, user_id=user.id, role="admin")
        notification = AutoSyncNotification(project)

        return render_preview_email_for_notification(notification, user)
