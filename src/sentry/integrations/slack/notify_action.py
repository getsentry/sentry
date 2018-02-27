from __future__ import absolute_import

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry import http
from sentry.rules.actions.base import EventAction
from sentry.utils import metrics, json
from sentry.models import Integration

from .utils import build_attachment


class SlackNotifyServiceForm(forms.Form):
    team = forms.ChoiceField(choices=(), widget=forms.Select(
        attrs={'style': 'width:150px'},
    ))
    channel = forms.CharField(widget=forms.TextInput(
        attrs={'placeholder': 'i.e #critical-errors'},
    ))

    def __init__(self, *args, **kwargs):
        # NOTE: Team maps directly to the integration ID
        team_list = [(i.id, i.name) for i in kwargs.pop('integrations')]
        self.channel_transformer = kwargs.pop('channel_transformer')

        super(SlackNotifyServiceForm, self).__init__(*args, **kwargs)

        if team_list:
            self.fields['team'].initial = team_list[0][0]

        self.fields['team'].choices = team_list
        self.fields['team'].widget.choices = self.fields['team'].choices

    def clean_channel(self):
        team = self.cleaned_data.get('team')
        channel = self.cleaned_data.get('channel', '').lstrip('#')

        channel_id = self.channel_transformer(team, channel)

        if channel_id is None and team is not None:
            params = {
                'channel': channel,
                'team': dict(self.fields['team'].choices).get(int(team)),
            }

            raise forms.ValidationError(
                _('The #%(channel)s channel does not exist in the %(team)s Slack team.'),
                code='invalid',
                params=params,
            )

        return channel


class SlackNotifyServiceAction(EventAction):
    form_cls = SlackNotifyServiceForm
    label = u'Send a notification to the Slack {team} team in {channel}'

    def is_enabled(self):
        return self.get_integrations().exists()

    def after(self, event, state):
        integration_id = self.get_option('team')
        channel = self.get_option('channel')

        integration = Integration.objects.get(
            provider='slack',
            organizations=self.project.organization,
            id=integration_id
        )

        def send_notification(event, futures):
            rules = [f.rule for f in futures]
            attachment = build_attachment(event.group, event=event, rules=rules)

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
                id=self.data['team'],
            ).name
        except Integration.DoesNotExist:
            integration_name = '[removed]'

        return self.label.format(
            team=integration_name,
            channel='#' + self.data['channel'],
        )

    def get_integrations(self):
        return Integration.objects.filter(
            provider='slack',
            organizations=self.project.organization,
        )

    def get_channel_id(self, integration_id, channel_name):
        try:
            integration = Integration.objects.get(
                provider='slack',
                organizations=self.project.organization,
                id=integration_id,
            )
        except Integration.DoesNotExist:
            return None

        payload = {
            'token': integration.metadata['access_token'],
            'exclude_archived': False,
            'exclude_members': True,
        }

        session = http.build_session()
        resp = session.get('https://slack.com/api/channels.list', params=payload)
        resp.raise_for_status()
        resp = resp.json()
        if not resp.get('ok'):
            self.logger.info('rule.slack.channel_list_failed', extra={'error': resp.get('error')})
            return None

        return {c['name']: c['id'] for c in resp['channels']}.get(channel_name)

    def get_form_instance(self):
        return self.form_cls(
            self.data,
            integrations=self.get_integrations(),
            channel_transformer=self.get_channel_id,
        )
