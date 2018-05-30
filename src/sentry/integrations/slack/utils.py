from __future__ import absolute_import

import logging

from six.moves.urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sentry import features, tagstore
from sentry.api.fields.actor import Actor
from sentry.utils import json
from sentry.utils.assets import get_asset_url
from sentry.utils.dates import to_timestamp
from sentry.utils.http import absolute_uri
from sentry.models import (
    GroupStatus, GroupAssignee, OrganizationMember, User, Identity, Team,
    Release
)

logger = logging.getLogger('sentry.integrations.slack')

# Attachment colors used for issues with no actions take
NEW_ISSUE_COLOR = '#E03E2F'
ACTIONED_ISSUE_COLOR = '#EDEEEF'


def format_actor_option(actor):
    if isinstance(actor, User):
        return {'text': actor.get_display_name(), 'value': u'user:{}'.format(actor.id)}
    if isinstance(actor, Team):
        return {'text': actor.slug, 'value': u'team:{}'.format(actor.id)}

    raise NotImplementedError


def get_member_assignees(group):
    queryset = OrganizationMember.objects.filter(
        user__is_active=True,
        organization=group.organization,
        teams__in=group.project.teams.all(),
    ).distinct().select_related('user')

    members = sorted(queryset, key=lambda u: u.user.get_display_name())

    return [format_actor_option(u.user) for u in members]


def get_team_assignees(group):
    return [format_actor_option(u) for u in group.project.teams.all()]


def get_assignee(group):
    try:
        assigned_actor = GroupAssignee.objects.get(group=group).assigned_actor()
    except GroupAssignee.DoesNotExist:
        return None

    try:
        return format_actor_option(assigned_actor.resolve())
    except assigned_actor.type.DoesNotExist:
        return None


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


def build_assigned_text(group, identity, assignee):
    actor = Actor.from_actor_id(assignee)

    try:
        assigned_actor = actor.resolve()
    except actor.type.DoesNotExist:
        return

    if actor.type == Team:
        assignee_text = assigned_actor.slug
    elif actor.type == User:
        try:
            assignee_ident = Identity.objects.get(
                user=assigned_actor,
                idp__type='slack',
                idp__external_id=identity.idp.external_id,
                idp__organization_id=0,
            )
            assignee_text = u'<@{}>'.format(assignee_ident.external_id)
        except Identity.DoesNotExist:
            try:
                assignee_ident = Identity.objects.get(
                    user=assigned_actor,
                    idp__type='slack',
                    idp__external_id=identity.idp.external_id,
                    idp__organization_id=group.project.organization_id,
                )
                assignee_text = u'<@{}>'.format(assignee_ident.external_id)
            except Identity.DoesNotExist:
                assignee_text = assigned_actor.get_display_name()
    else:
        raise NotImplementedError

    return u'*Issue assigned to {assignee_text} by <@{user_id}>*'.format(
        assignee_text=assignee_text,
        user_id=identity.external_id,
    )


def build_action_text(group, identity, action):
    if action['name'] == 'assign':
        return build_assigned_text(group, identity, action['selected_options'][0]['value'])

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

    members = get_member_assignees(group)
    teams = get_team_assignees(group)

    logo_url = absolute_uri(get_asset_url('sentry', 'images/sentry-email-avatar.png'))
    color = NEW_ISSUE_COLOR

    text = build_attachment_text(group, event) or ''

    if actions is None:
        actions = []

    assignee = get_assignee(group)

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

    has_releases = Release.objects.filter(
        projects=group.project,
        organization_id=group.project.organization_id
    ).exists()

    if not has_releases:
        resolve_button.update({
            'name': 'status',
            'text': 'Resolve',
            'value': 'resolved',
        })

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

    option_groups = []

    if teams:
        option_groups.append({
            'text': 'Teams',
            'options': teams,
        })

    if members:
        option_groups.append({
            'text': 'People',
            'options': members,
        })

    payload_actions = [
        resolve_button,
        ignore_button,
        {
            'name': 'assign',
            'text': 'Select Assignee...',
            'type': 'select',
            'selected_options': [assignee],
            'option_groups': option_groups,
        },
    ]

    # TODO(epurkhiser): Remove when teams are no longer early adopter
    if not features.has('organizations:new-teams', group.organization):
        payload_actions[2]['options'] = members
        del payload_actions[2]['option_groups']

    fields = []

    if tags:
        event_tags = event.tags if event else group.get_latest_event().tags

        for key, value in event_tags:
            std_key = tagstore.get_standardized_key(key)
            if std_key not in tags:
                continue

            labeled_value = tagstore.get_tag_value_label(key, value)
            fields.append(
                {
                    'title': std_key.encode('utf-8'),
                    'value': labeled_value.encode('utf-8'),
                    'short': True,
                }
            )

    if actions:
        action_texts = filter(None, [build_action_text(group, identity, a) for a in actions])
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
