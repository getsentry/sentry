from django.views.generic import View

from sentry.models import Organization, Project
from sentry.utils.http import absolute_uri
from sentry.utils.samples import create_sample_event

from .mail import MailPreview


class DebugNewUserFeedbackEmailView(View):
    def get(self, request):
        org = Organization(id=1, slug="organization", name="My Company")
        project = Project(id=1, organization=org, slug="project", name="My Project")

        event = create_sample_event(
            project=project, platform="python", event_id="595", timestamp=1452683305
        )

        group = event.group
        link = absolute_uri(
            f"/{project.organization.slug}/{project.slug}/issues/{group.id}/feedback/"
        )

        return MailPreview(
            html_template="sentry/emails/activity/new-user-feedback.html",
            text_template="sentry/emails/activity/new-user-feedback.txt",
            context={
                "group": group,
                "report": {
                    "name": "Homer Simpson",
                    "email": "homer.simpson@example.com",
                    "comments": "I hit a bug.\n\nI went to https://example.com, hit the any key, and then it stopped working. DOH!",
                },
                "link": link,
                "reason": "are subscribed to this issue",
                "enhanced_privacy": False,
            },
        ).render(request)
