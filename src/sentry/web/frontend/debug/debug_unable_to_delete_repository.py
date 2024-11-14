from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.models.repository import Repository
from sentry.plugins.providers.dummy import DummyRepositoryProvider

from .mail import MailPreview


class DebugUnableToDeleteRepository(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        repo = Repository(name="getsentry/sentry", provider="dummy")
        repo.get_provider = lambda: DummyRepositoryProvider("dummy")  # type: ignore[method-assign]

        email = repo.generate_delete_fail_email("An internal server error occurred")
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
