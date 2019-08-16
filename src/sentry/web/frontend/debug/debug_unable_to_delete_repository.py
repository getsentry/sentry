from __future__ import absolute_import, print_function

import types

from django.views.generic import View

from sentry.models import Repository
from sentry.plugins.providers.dummy import DummyRepositoryProvider

from .mail import MailPreview


class DebugUnableToDeleteRepository(View):
    def get(self, request):
        def mock_get_provider(self):
            return DummyRepositoryProvider("dummy")

        repo = Repository(name="getsentry/sentry", provider="dummy")
        repo.get_provider = types.MethodType(mock_get_provider, repo)

        email = repo.generate_delete_fail_email("An internal server error occurred")
        return MailPreview(
            html_template=email.html_template, text_template=email.template, context=email.context
        ).render(request)
