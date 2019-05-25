from __future__ import absolute_import

import logging
import six
import sentry

from django import forms
from django.conf import settings
from django.utils.translation import ugettext_lazy as _

from sentry import features
from sentry.exceptions import PluginError
from sentry.models import Event
from sentry.plugins.bases import notify
from sentry.http import is_valid_url, safe_urlopen
from sentry.utils.safe import safe_execute


def split_urls(value):
    if not value:
        return ()
    return filter(bool, (url.strip() for url in value.splitlines()))


def validate_urls(value, **kwargs):
    urls = split_urls(value)
    if any((not u.startswith(('http://', 'https://')) or not is_valid_url(u)) for u in urls):
        raise PluginError('Not a valid URL.')
    return '\n'.join(urls)


class WebHooksOptionsForm(notify.NotificationConfigurationForm):
    urls = forms.CharField(
        label=_('Callback URLs'),
        widget=forms.Textarea(
            attrs={'class': 'span6',
                   'placeholder': 'https://sentry.io/callback/url'}
        ),
        help_text=_('Enter callback URLs to POST new events to (one per line).')
    )


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
    # TODO(dcramer): remove when this is migrated to React
    project_conf_form = WebHooksOptionsForm
    timeout = getattr(settings, 'SENTRY_WEBHOOK_TIMEOUT', 3)
    logger = logging.getLogger('sentry.plugins.webhooks')
    user_agent = 'sentry-webhooks/%s' % version

    def is_configured(self, project, **kwargs):
        return bool(self.get_option('urls', project))

    def get_config(self, project, **kwargs):
        return [
            {
                'name': 'urls',
                'label': 'Callback URLs',
                'type': 'textarea',
                'help': 'Enter callback URLs to POST new events to (one per line).',
                'placeholder': 'https://sentry.io/callback/url',
                'validators': [validate_urls],
                'required': False
            }
        ]

    def get_group_data(self, group, event, triggering_rules):
        data = {
            'id': six.text_type(group.id),
            'project': group.project.slug,
            'project_name': group.project.name,
            'project_slug': group.project.slug,
            'logger': event.get_tag('logger'),
            'level': event.get_tag('level'),
            'culprit': group.culprit,
            'message': event.real_message,
            'url': group.get_absolute_url(params={'referrer': 'webhooks_plugin'}),
            'triggering_rules': triggering_rules,
        }
        data['event'] = dict(event.data or {})
        data['event']['tags'] = event.tags
        data['event']['event_id'] = event.event_id
        if features.has('organizations:legacy-event-id', group.project.organization):
            try:
                data['event']['id'] = Event.objects.filter(
                    project_id=event.project_id,
                    event_id=event.event_id,
                ).values_list('id', flat=True).get()
            except Event.DoesNotExist:
                data['event']['id'] = None
        return data

    def get_webhook_urls(self, project):
        return split_urls(self.get_option('urls', project))

    def send_webhook(self, url, payload):
        return safe_urlopen(
            url=url,
            json=payload,
            timeout=self.timeout,
            verify_ssl=False,
        )

    def notify_users(self, group, event, triggering_rules, fail_silently=False, **kwargs):
        payload = self.get_group_data(group, event, triggering_rules)
        for url in self.get_webhook_urls(group.project):
            safe_execute(self.send_webhook, url, payload, _with_transaction=False)
