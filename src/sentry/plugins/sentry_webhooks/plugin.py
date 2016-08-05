from __future__ import absolute_import

import logging
import six
import sentry

from django.conf import settings
from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.plugins.bases import notify
from sentry.http import is_valid_url, safe_urlopen
from sentry.utils.safe import safe_execute


class WebHooksOptionsForm(notify.NotificationConfigurationForm):
    urls = forms.CharField(
        label=_('Callback URLs'),
        widget=forms.Textarea(attrs={
            'class': 'span6', 'placeholder': 'https://getsentry.com/callback/url'}),
        help_text=_('Enter callback URLs to POST new events to (one per line).'))

    def clean_url(self):
        value = self.cleaned_data.get('url')
        if not is_valid_url(value):
            raise forms.ValidationError('Invalid hostname')
        return value


class WebHooksPlugin(notify.NotificationPlugin):
    author = 'Sentry Team'
    author_url = 'https://github.com/getsentry/sentry'
    version = sentry.VERSION
    description = "Integrates web hooks."
    resource_links = [
        ('Bug Tracker', 'https://github.com/getsentry/sentry/issues'),
        ('Source', 'https://github.com/getsentry/sentry'),
    ]

    slug = 'webhooks'
    title = 'WebHooks'
    conf_title = title
    conf_key = 'webhooks'
    project_conf_form = WebHooksOptionsForm
    timeout = getattr(settings, 'SENTRY_WEBHOOK_TIMEOUT', 3)
    logger = logging.getLogger('sentry.plugins.webhooks')
    user_agent = 'sentry-webhooks/%s' % version

    def is_configured(self, project, **kwargs):
        return bool(self.get_option('urls', project))

    def get_group_data(self, group, event):
        data = {
            'id': six.text_type(group.id),
            'project': group.project.slug,
            'project_name': group.project.name,
            'logger': event.get_tag('logger'),
            'level': event.get_tag('level'),
            'culprit': group.culprit,
            'message': event.get_legacy_message(),
            'url': group.get_absolute_url(),
        }
        data['event'] = dict(event.data or {})
        data['event']['tags'] = event.get_tags()
        return data

    def get_webhook_urls(self, project):
        urls = self.get_option('urls', project)
        if not urls:
            return ()
        return filter(bool, urls.strip().splitlines())

    def send_webhook(self, url, payload):
        return safe_urlopen(
            url=url,
            json=payload,
            timeout=self.timeout,
            verify_ssl=False,
        )

    def notify_users(self, group, event, fail_silently=False):
        payload = self.get_group_data(group, event)
        for url in self.get_webhook_urls(group.project):
            safe_execute(self.send_webhook, url, payload, _with_transaction=False)
