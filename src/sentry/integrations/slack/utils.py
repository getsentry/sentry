from __future__ import absolute_import

import logging

from six.moves.urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sentry.models import GroupStatus


logger = logging.getLogger('sentry.integrations.slack')


def add_notification_referrer_param(url, provider):
    parsed_url = urlparse(url)
    query = parse_qs(parsed_url.query)
    query['referrer'] = provider
    url_list = list(parsed_url)
    url_list[4] = urlencode(query, doseq=True)
    return urlunparse(url_list)


def build_workflow_message(activity):
    from sentry.plugins.sentry_mail.activity import emails

    cls = emails.get(activity.type)
    if cls is None:
        return

    email = cls(activity)

    context = email.get_context()

    return {
        'text': context['text_description'],
    }


def build_attachment_title(group, event=None):
    ev_metadata = group.get_event_metadata()
    ev_type = group.get_event_type()
    if ev_type == 'error':
        if group.culprit:
            return '{} - {}'.format(ev_metadata['type'][:40], group.culprit)
        return ev_metadata['type']
    elif ev_type == 'csp':
        return '{} - {}'.format(ev_metadata['directive'], ev_metadata['uri'])
    else:
        if group.culprit:
            return '{} - {}'.format(group.title[:40], group.culprit)
        return group.title


def build_attachment_pretext(group, event=None):
    ev_metadata = group.get_event_metadata()
    ev_type = group.get_event_type()
    if ev_type == 'error':
        return ev_metadata['value']
    else:
        return None


def build_attachment(group, event=None):
    # XXX(dcramer): options are limited to 100 choices, even when nested
    status = group.get_status()
    if status == GroupStatus.UNRESOLVED:
        status_label = 'Unresolved'
    elif status == GroupStatus.RESOLVED:
        status_label = 'Resolved'
    elif status == GroupStatus.IGNORED:
        status_label = 'Ignored'
    else:
        status_label = 'n/a'

    return {
        'fallback': '[{}] {}'.format(group.project.slug, group.title),
        'title': build_attachment_title(group, event),
        'title_link': add_notification_referrer_param(group.get_absolute_url(), 'slack'),
        'text': build_attachment_pretext(group, event),
        'callback_id': 'issue:{}'.format(group.id),
        'footer': '{} / {}'.format(
            group.organization.slug,
            group.project.slug,
        ),
        'color': '#6C5FC7',
        'actions': [
            {
                'name': 'assignedTo',
                'text': 'Assign ..',
                'type': 'select',
                'options': [
                    {'text': 'David Cramer', 'value': 'dcramer'},
                    {'text': 'George Castanza', 'value': 'george'},
                ],
                "selected_options": [
                    {
                        "text": "Assigned to: David Cramer",
                        "value": "dcramer"
                    }
                ]
            },
            {
                'name': 'status',
                'text': 'Status: {}'.format(status_label),
                'type': 'select',
                'option_groups': [
                    {
                        'text': 'Ignore until ..',
                        'options': [
                            {'text': 'Forever', 'value': 'ignore'},
                        ]
                    },
                    {
                        'text': 'Resolve in ..',
                        'options': [
                            {'text': 'The next release', 'value': 'resolve:inNextRelease'},
                            {'text': 'The current release', 'value': 'resolve:inCurrentRelease'},
                        ]
                    }
                ]
            }
        ],
    }
