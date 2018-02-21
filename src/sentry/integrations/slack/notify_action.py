from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry import http
from sentry.rules.actions.base import EventAction
from sentry.utils import metrics, json
from sentry.models import Integration

from .utils import build_attachment

MEMBER_PREFIX = '@'
CHANNEL_PREFIX = '#'
strip_channel_chars = ''.join([MEMBER_PREFIX, CHANNEL_PREFIX])


class SlackNotifyServiceForm(forms.Form):
    workspace = forms.ChoiceField(choices=(), widget=forms.Select(
        attrs={'style': 'width:150px'},
    ))
    channel = forms.CharField(widget=forms.TextInput(
        attrs={'placeholder': 'i.e #critical or @evan'},
    ))
    channel_id = forms.HiddenInput()

    def __init__(self, *args, **kwargs):
        # NOTE: Workspace maps directly to the integration ID
        workspace_list = [(i.id, i.name) for i in kwargs.pop('integrations')]
        self.channel_transformer = kwargs.pop('channel_transformer')

        super(SlackNotifyServiceForm, self).__init__(*args, **kwargs)

        if workspace_list:
            self.fields['workspace'].initial = workspace_list[0][0]

        self.fields['workspace'].choices = workspace_list
        self.fields['workspace'].widget.choices = self.fields['workspace'].choices

    def clean(self):
        cleaned_data = super(SlackNotifyServiceForm, self).clean()

        workspace = cleaned_data.get('workspace')
        channel = cleaned_data.get('channel', '').lstrip(strip_channel_chars)

        channel_id = self.channel_transformer(workspace, channel)

        if channel_id is None and workspace is not None:
            params = {
                'channel': channel,
                'workspace': dict(self.fields['workspace'].choices).get(int(workspace)),
            }

            raise forms.ValidationError(
                _('The "%(channel)s" channel or user does not exist in the %(workspace)s Slack workspace.'),
                code='invalid',
                params=params,
            )

        channel_prefix, channel_id = channel_id
        cleaned_data['channel'] = channel_prefix + channel
        cleaned_data['channel_id'] = channel_id

        return cleaned_data


class SlackNotifyServiceAction(EventAction):
    form_cls = SlackNotifyServiceForm
    label = u'Send a notification to the Slack {workspace} workspace to {channel}'

    def is_enabled(self):
        return self.get_integrations().exists()

    def after(self, event, state):
        integration_id = self.get_option('workspace')
        channel = self.get_option('channel_id')

        try:
            integration = Integration.objects.get(
                provider='slack',
                organizations=self.project.organization,
                id=integration_id
            )
        except Integration.DoesNotExist:
            # Integration removed, rule still active.
            return

        def send_notification(event, futures):
            attachment = build_attachment(event.group, event=event)

            payload = {
                'token': integration.metadata['access_token'],
                'channel': channel,
                'attachments': json.dumps([attachment]),
            }

            session = http.build_session()
            resp = session.post('https://slack.com/api/chat.postMessage', data=payload)
            resp.raise_for_status()
            resp = resp.json()
            if not resp.get('ok'):
                self.logger.info('rule.fail.slack_post', extra={'error': resp.get('error')})

        metrics.incr('notifications.sent', instance='slack.notification')
        yield self.future(send_notification)

    def render_label(self):
        try:
            integration_name = Integration.objects.get(
                provider='slack',
                organizations=self.project.organization,
                id=self.data.get('workspace')
            ).name
        except Integration.DoesNotExist:
            integration_name = '[removed]'

        return self.label.format(
            workspace=integration_name,
            channel=self.data['channel'],
        )

    def get_integrations(self):
        return Integration.objects.filter(
            provider='slack',
            organizations=self.project.organization,
        )

    def get_channel_id(self, integration_id, name):
        try:
            integration = Integration.objects.get(
                provider='slack',
                organizations=self.project.organization,
                id=integration_id,
            )
        except Integration.DoesNotExist:
            return None

        # Look for channel ID
        payload = {
            'token': integration.metadata['access_token'],
            'exclude_archived': False,
            'exclude_members': True,
        }

        session = http.build_session()
        resp = session.get('https://slack.com/api/channels.list', params=payload)
        resp = resp.json()
        if not resp.get('ok'):
            self.logger.info('rule.slack.channel_list_failed', extra={'error': resp.get('error')})
            return None

        channel_id = {c['name']: c['id'] for c in resp['channels']}.get(name)

        if channel_id:
            return (CHANNEL_PREFIX, channel_id)

        # Look for user ID
        payload = {
            'token': integration.metadata['access_token'],
        }

        resp = session.get('https://slack.com/api/users.list', params=payload)
        resp = resp.json()
        if not resp.get('ok'):
            self.logger.info('rule.slack.user_list_failed', extra={'error': resp.get('error')})
            return None

        member_id = {c['name']: c['id'] for c in resp['members']}.get(name)

        if member_id:
            return (MEMBER_PREFIX, member_id)

        return None

    def get_form_instance(self):
        return self.form_cls(
            self.data,
            integrations=self.get_integrations(),
            channel_transformer=self.get_channel_id,
        )
