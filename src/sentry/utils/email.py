"""
sentry.utils.email
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from pynliner import Pynliner

from sentry.web.helpers import render_to_string


class MessageBuilder(object):
    def __init__(self, subject, context=None, template=None, html_template=None,
                 body=None, html_body=None, headers=None):
        assert not (body and template)
        assert not (html_body and html_template)
        assert context or not (template or html_template)

        self.subject = subject
        self.context = context
        self.template = template
        self.html_template = html_template
        self.body = body
        self.html_body = html_body
        self.headers = headers

    def build(self, to):
        if self.headers is None:
            headers = {}
        else:
            headers = self.headers.copy()

        headers.setdefault('Reply-To', ', '.join(to))

        if self.template:
            txt_body = render_to_string(self.template, self.context)
        else:
            txt_body = self.body

        if self.html_template:
            html_body = render_to_string(self.html_template, self.context)
        else:
            html_body = self.html_body

        msg = EmailMultiAlternatives(
            self.subject,
            txt_body,
            settings.SERVER_EMAIL,
            to,
            headers=headers
        )
        if html_body:
            msg.attach_alternative(
                UnicodeSafePynliner().from_string(html_body).run(),
                "text/html")

        return msg

    def send(self, to, fail_silently=False):
        msg = self.build(to)
        msg.send(fail_silently=fail_silently)


class UnicodeSafePynliner(Pynliner):
    def _get_output(self):
        """
        Generate Unicode string of `self.soup` and set it to `self.output`

        Returns self.output
        """
        self.output = unicode(self.soup)
        return self.output
