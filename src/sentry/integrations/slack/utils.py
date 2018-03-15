from __future__ import absolute_import

import logging

from django.db.models import Q
from six.moves.urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sentry.utils.dates import to_timestamp
from sentry.utils import json
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri
from sentry.models import GroupStatus, GroupAssignee, OrganizationMember, User, Identity

logger = logging.getLogger('sentry.integrations.slack')

UNASSIGN_OPTION = {
    'text': u':negative_squared_cross_mark: Unassign Issue',
    'value': 'none',
}

# Attachment colors used for issues with no actions take
NEW_ISSUE_COLOR = '#E03E2F'
ACTIONED_ISSUE_COLOR = '#EDEEEF'


def get_assignees(group):
    queryset = OrganizationMember.objects.filter(
        Q(user__is_active=True) | Q(user__isnull=True),
        organization=group.organization,
        teams__in=group.project.teams.all(),
    ).select_related('user')

    members = sorted(queryset, key=lambda x: x.user.get_display_name() if x.user_id else x.email)
    members = filter(lambda m: m.user_id is not None, members)

    return [{'text': x.user.get_display_name(), 'value': x.user.username} for x in members]


def add_notification_referrer_param(url, provider):
    parsed_url = urlparse(url)
    query = parse_qs(parsed_url.query)
    query['referrer'] = provider
    url_list = list(parsed_url)
    url_list[4] = urlencode(query, doseq=True)
    return urlunparse(url_list)


def build_attachment_title(group, event=None):
    ev_metadata = group.get_event_metadata()
    ev_type = group.get_event_type()
    if ev_type == 'error':
        if group.culprit:
            return u'{} - {}'.format(ev_metadata['type'][:40], group.culprit)
        return ev_metadata['type']
    elif ev_type == 'csp':
        return u'{} - {}'.format(ev_metadata['directive'], ev_metadata['uri'])
    else:
        if group.culprit:
            return u'{} - {}'.format(group.title[:40], group.culprit)
        return group.title


def build_attachment_text(group, event=None):
    ev_metadata = group.get_event_metadata()
    ev_type = group.get_event_type()
    if ev_type == 'error':
        return ev_metadata['value']
    else:
        return None


def build_assigned_text(identity, assignee):
    if assignee == 'none':
        return u'*Issue unassigned by <@{user_id}>*'.format(
            user_id=identity.external_id,
        )

    try:
        assignee_user = User.objects.get(username=assignee)
    except User.DoesNotExist:
        return

    try:
        assignee_ident = Identity.objects.get(user=assignee_user)
        assignee_text = u'<@{}>'.format(assignee_ident.external_id)
    except Identity.DoesNotExist:
        assignee_text = assignee_user.get_display_name()

    return u'*Issue assigned to {assignee_text} by <@{user_id}>*'.format(
        assignee_text=assignee_text,
        user_id=identity.external_id,
    )


def build_action_text(identity, action):
    if action['name'] == 'assign':
        return build_assigned_text(identity, action['selected_options'][0]['value'])

    statuses = {
        'resolved': 'resolved',
        'ignored': 'ignored',
        'unresolved': 're-opened',
    }

    # Resolve actions have additional 'parameters' after ':'
    status = action['value'].split(':', 1)[0]

    # Action has no valid action text, ignore
    if status not in statuses:
        return

    return u'*Issue {status} by <@{user_id}>*'.format(
        status=statuses[status],
        user_id=identity.external_id,
    )


def build_attachment(group, event=None, tags=None, identity=None, actions=None, rules=None):
    # XXX(dcramer): options are limited to 100 choices, even when nested
    status = group.get_status()
    assignees = get_assignees(group)

    logo_url = absolute_uri(get_asset_url('sentry', 'images/sentry-email-avatar.png'))
    color = NEW_ISSUE_COLOR

    text = build_attachment_text(group, event) or ''

    if actions is None:
        actions = []

    try:
        assignee = GroupAssignee.objects.get(group=group).user
        assignee = {
            'text': assignee.get_display_name(),
            'value': assignee.username,
        }

        # Add unassign option to the top of the list
        assignees.insert(0, UNASSIGN_OPTION)
    except GroupAssignee.DoesNotExist:
        assignee = None

    resolve_button = {
        'name': 'resolve_dialog',
        'value': 'resolve_dialog',
        'type': 'button',
        'text': 'Resolve...',
    }

    ignore_button = {
        'name': 'status',
        'value': 'ignored',
        'type': 'button',
        'text': 'Ignore',
    }

    if status == GroupStatus.RESOLVED:
        resolve_button.update({
            'name': 'status',
            'text': 'Unresolve',
            'value': 'unresolved',
        })

    if status == GroupStatus.IGNORED:
        ignore_button.update({
            'text': 'Stop Ignoring',
            'value': 'unresolved',
        })

    payload_actions = [
        resolve_button,
        ignore_button,
        {
            'name': 'assign',
            'text': 'Select Assignee...',
            'type': 'select',
            'options': assignees,
            'selected_options': [assignee],
        },
    ]

    fields = []

    if tags:
        event_tags = event.tags if event else group.get_latest_event().tags

        for tag_key, tag_value in event_tags:
            if tag_key in tags:
                fields.append(
                    {
                        'title': tag_key.encode('utf-8'),
                        'value': tag_value.encode('utf-8'),
                        'short': True,
                    }
                )

    if actions:
        action_texts = filter(None, [build_action_text(identity, a) for a in actions])
        text += '\n' + '\n'.join(action_texts)

        color = ACTIONED_ISSUE_COLOR
        payload_actions = []

    ts = group.last_seen

    if event:
        event_ts = event.datetime
        ts = max(ts, event_ts)

    footer = u'{}'.format(group.qualified_short_id)

    if rules:
        footer += u' via {}'.format(rules[0].label)

        if len(rules) > 1:
            footer += u' (+{} other)'.format(len(rules) - 1)

    return {
        'fallback': u'[{}] {}'.format(group.project.slug, group.title),
        'title': build_attachment_title(group, event),
        'title_link': add_notification_referrer_param(group.get_absolute_url(), 'slack'),
        'text': text,
        'fields': fields,
        'mrkdwn_in': ['text'],
        'callback_id': json.dumps({'issue': group.id}),
        'footer_icon': logo_url,
        'footer': footer,
        'ts': to_timestamp(ts),
        'color': color,
        'actions': payload_actions,
    }
