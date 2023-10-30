from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.models.organization import Organization

from .mail import MailPreview


class DebugMissingMembersNudgeView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        self.organization = Organization(id=1, slug="organization", name="My Company")
        commit_authors = [
            {
                "email": "test@sentry.io",
                "external_id": "test",
                "commit_count": 5,
                "profile_link": "https://github.com/test",
            },
            {
                "email": "hello@sentry.io",
                "external_id": "hello",
                "commit_count": 4,
                "profile_link": "https://github.com/hello",
            },
            {
                "email": "abcd@sentry.io",
                "external_id": "abcd",
                "commit_count": 3,
                "profile_link": "https://github.com/abcd",
            },
            {
                "email": "link@sentry.io",
                "external_id": "link",
                "commit_count": 2,
                "profile_link": "https://github.com/link",
            },
            {
                "email": "hola@sentry.io",
                "external_id": "hola",
                "commit_count": 1,
                "profile_link": "https://github.com/hola",
            },
        ]

        return MailPreview(
            html_template="sentry/emails/missing-members-nudge.html",
            text_template="sentry/emails/missing-members-nudge.txt",
            context={
                "organization": self.organization,
                "top_missing_members": commit_authors[0:3],
                "members_list_url": "https://sentry.io/",
                "provider": "Github",
            },
        ).render(request)
