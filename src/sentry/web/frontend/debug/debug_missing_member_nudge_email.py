from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.models import Organization

from .mail import MailPreview


class DebugMissingMembersNudgeView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        self.organization = Organization(id=1, slug="organization", name="My Company")
        commit_authors = [
            {
                "email": "test@sentry.io",
                "external_id": "test",
                "commit_count": 5,
            },
            {
                "email": "hello@sentry.io",
                "external_id": "hello",
                "commit_count": 4,
            },
            {
                "email": "abcd@sentry.io",
                "external_id": "abcd",
                "commit_count": 3,
            },
            {
                "email": "link@sentry.io",
                "external_id": "link",
                "commit_count": 2,
            },
            {
                "email": "hola@sentry.io",
                "external_id": "hola",
                "commit_count": 1,
            },
        ]

        return MailPreview(
            html_template="sentry/emails/missing-members-nudge.html",
            text_template="sentry/emails/missing-members-nudge.txt",
            context={
                "organization": self.organization,
                "missing_members": commit_authors[0:3],
                "missing_members_count": len(commit_authors),
                "members_list_url": "https://sentry.io/",
            },
        ).render(request)
