from types import SimpleNamespace

from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.models.repository import Repository
from sentry.web.frontend.base import internal_cell_silo_view

from .mail import MailPreview


@internal_cell_silo_view
class DebugUnableToDeleteRepository(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        repo = Repository(name="getsentry/sentry", provider="integrations:example")
        repo.get_provider = lambda: SimpleNamespace(name="Example")  # type: ignore[method-assign]

        email = repo.generate_delete_fail_email("An internal server error occurred")
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
