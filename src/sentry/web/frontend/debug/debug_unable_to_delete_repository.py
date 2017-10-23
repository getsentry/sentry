from __future__ import absolute_import, print_function

from django.views.generic import View

from sentry.models import Repository

from .mail import MailPreview


class DebugUnableToDeleteRepository(View):
    def get(self, request):
        repo = Repository(name='getsentry/sentry')

        email = repo.generate_delete_fail_email(
            'An internal server error occurred'
        )
        return MailPreview(
            html_template=email.html_template,
            text_template=email.template,
            context=email.context,
        ).render(request)
