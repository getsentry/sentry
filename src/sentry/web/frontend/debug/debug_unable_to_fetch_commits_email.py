from __future__ import absolute_import, print_function

from django.views.generic import View

from sentry.models import Release, Repository
from sentry.tasks.commits import generate_fetch_commits_error_email

from .mail import MailPreview


class DebugUnableToFetchCommitsEmailView(View):
    def get(self, request):
        release = Release(version="abcdef")
        repo = Repository(name="repo_name")

        email = generate_fetch_commits_error_email(
            release, repo, "An internal server error occurred"
        )
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
