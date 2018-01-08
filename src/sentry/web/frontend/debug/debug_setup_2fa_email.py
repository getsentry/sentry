from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.utils.http import absolute_uri
from django.views.generic import View

from .mail import MailPreview

from sentry.models import Organization


class DebugSetup2faEmailView(View):
    def get(self, request):
        context = {
            'user': request.user,
            'url': absolute_uri(reverse('sentry-account-settings-2fa')),
            'organization': Organization(
                id=1,
                slug='organization',
                name='Sentry Corp',
            )
        }
        return MailPreview(
            html_template='sentry/emails/setup_2fa.html',
            text_template='sentry/emails/setup_2fa.txt',
            context=context,
        ).render(request)
