from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.models.organization import Organization
from sentry.models.release import Release
from sentry.models.repository import Repository
from sentry.tasks.commits import generate_fetch_commits_error_email

from .mail import MailPreview


class DebugUnableToFetchCommitsEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        org = Organization(slug="myorg")
        release = Release(version="abcdef", organization=org)
        repo = Repository(name="repo_name")

        email = generate_fetch_commits_error_email(
            release, repo, "An internal server error occurred"
        )
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
