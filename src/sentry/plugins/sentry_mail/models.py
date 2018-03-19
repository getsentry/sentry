"""
sentry.plugins.sentry_mail.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import itertools
import logging
import six

import sentry

from django.core.urlresolvers import reverse
from django.utils import dateformat
from django.utils.encoding import force_text
from django.utils.safestring import mark_safe

from sentry import features, options
from sentry.models import ProjectOwnership, User

from sentry.digests.utilities import get_digest_metadata
from sentry.digests.notifications import build_digest, event_to_record
from sentry.plugins import register
from sentry.plugins.base.structs import Notification
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.committers import get_event_file_committers
from sentry.utils.email import MessageBuilder, group_id_to_email
from sentry.utils.http import absolute_uri
from sentry.utils.linksign import generate_signed_link

from .activity import emails

NOTSET = object()

logger = logging.getLogger(__name__)


class MailPlugin(NotificationPlugin):
    title = 'Mail'
    conf_key = 'mail'
    slug = 'mail'
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    project_default_enabled = True
    project_conf_form = None
    subject_prefix = None

    def _subject_prefix(self):
        if self.subject_prefix is not None:
            return self.subject_prefix
        return options.get('mail.subject-prefix')

    def _build_message(
        self,
        project,
        subject,
        template=None,
        html_template=None,
        body=None,
        reference=None,
        reply_reference=None,
        headers=None,
        context=None,
        send_to=None,
        type=None
    ):
        if send_to is None:
            send_to = self.get_send_to(project)
        if not send_to:
            logger.debug('Skipping message rendering, no users to send to.')
            return

        subject_prefix = self.get_option('subject_prefix', project) or self._subject_prefix()
        subject_prefix = force_text(subject_prefix)
        subject = force_text(subject)

        msg = MessageBuilder(
            subject='%s%s' % (subject_prefix, subject),
            template=template,
            html_template=html_template,
            body=body,
            headers=headers,
            type=type,
            context=context,
            reference=reference,
            reply_reference=reply_reference,
        )
        msg.add_users(send_to, project=project)
        return msg

    def _send_mail(self, *args, **kwargs):
        message = self._build_message(*args, **kwargs)
        if message is not None:
            return message.send_async()

    def get_notification_settings_url(self):
        return absolute_uri(reverse('sentry-account-settings-notifications'))

    def get_project_url(self, project):
        return absolute_uri('/{}/{}/'.format(project.organization.slug, project.slug))

    def is_configured(self, project, **kwargs):
        # Nothing to configure here
        return True

    def should_notify(self, group, event):
        send_to = self.get_sendable_users(group.project)
        if not send_to:
            return False

        return super(MailPlugin, self).should_notify(group, event)

    def get_send_to(self, project, event=None):
        """
        Returns a list of user IDs for the users that should receive
        notifications for the provided project.

        This result may come from cached data.
        """
        if not (project and project.teams.exists()):
            logger.debug('Tried to send notification to invalid project: %r', project)
            return []

        if event:
            owners, _ = ProjectOwnership.get_owners(project.id, event.data)
            if owners != ProjectOwnership.Everyone:
                if not owners:
                    metrics.incr(
                        'features.owners.send_to',
                        tags={
                            'organization': project.organization_id,
                            'outcome': 'empty',
                        },
                        skip_internal=True,
                    )
                    return []

                metrics.incr(
                    'features.owners.send_to',
                    tags={
                        'organization': project.organization_id,
                        'outcome': 'match',
                    },
                    skip_internal=True,
                )
                send_to_list = []
                teams_to_resolve = []
                for owner in owners:
                    if owner.type == User:
                        send_to_list.append(owner.id)
                    else:
                        teams_to_resolve.append(owner.id)

                # get all users in teams
                if teams_to_resolve:
                    send_to_list += User.objects.filter(
                        is_active=True,
                        sentry_orgmember_set__organizationmemberteam__team__id__in=teams_to_resolve,
                    ).values_list('id', flat=True)
                return send_to_list
            else:
                metrics.incr(
                    'features.owners.send_to',
                    tags={
                        'organization': project.organization_id,
                        'outcome': 'everyone',
                    },
                    skip_internal=True,
                )

        cache_key = '%s:send_to:%s' % (self.get_conf_key(), project.pk)
        send_to_list = cache.get(cache_key)
        if send_to_list is None:
            send_to_list = [s for s in self.get_sendable_users(project) if s]
            cache.set(cache_key, send_to_list, 60)  # 1 minute cache

        return send_to_list

    def add_unsubscribe_link(self, context, user_id, project):
        context['unsubscribe_link'] = generate_signed_link(
            user_id,
            'sentry-account-email-unsubscribe-project',
            kwargs={
                'project_id': project.id,
            }
        )

    def notify(self, notification, users=None):
        from sentry.models import Commit, Release

        event = notification.event

        group = event.group
        project = group.project
        org = group.organization

        subject = event.get_email_subject()

        link = group.get_absolute_url()

        template = 'sentry/emails/error.txt'
        html_template = 'sentry/emails/error.html'

        rules = []
        for rule in notification.rules:
            rule_link = '/%s/%s/settings/alerts/rules/%s/' % (org.slug, project.slug, rule.id)

            rules.append((rule.label, rule_link))

        enhanced_privacy = org.flags.enhanced_privacy

        # lets identify possibly suspect commits and owners
        commits = {}
        if features.has('organizations:suggested-commits', org):
            try:
                committers = get_event_file_committers(project, event)
            except (Commit.DoesNotExist, Release.DoesNotExist):
                pass
            except Exception as exc:
                logging.exception(six.text_type(exc))
            else:
                for committer in committers:
                    for commit in committer['commits']:
                        if commit['id'] not in commits:
                            commit_data = commit.copy()
                            commit_data['shortId'] = commit_data['id'][:7]
                            commit_data['author'] = committer['author']
                            commit_data['subject'] = commit_data['message'].split('\n', 1)[0]
                            commits[commit['id']] = commit_data

        context = {
            'project_label': project.get_full_name(),
            'group': group,
            'event': event,
            'link': link,
            'rules': rules,
            'enhanced_privacy': enhanced_privacy,
            'commits': sorted(commits.values(), key=lambda x: x['score'], reverse=True),
        }

        # if the organization has enabled enhanced privacy controls we dont send
        # data which may show PII or source code
        if not enhanced_privacy:
            interface_list = []
            for interface in six.itervalues(event.interfaces):
                body = interface.to_email_html(event)
                if not body:
                    continue
                text_body = interface.to_string(event)
                interface_list.append((interface.get_title(), mark_safe(body), text_body))

            context.update({
                'tags': event.get_tags(),
                'interfaces': interface_list,
            })

        headers = {
            'X-Sentry-Logger': group.logger,
            'X-Sentry-Logger-Level': group.get_level_display(),
            'X-Sentry-Project': project.slug,
            'X-Sentry-Reply-To': group_id_to_email(group.id),
        }

        send_to_users = users or self.get_send_to(project=project, event=event)
        for user_id in send_to_users:
            self.add_unsubscribe_link(context, user_id, project)
            self._send_mail(
                subject=subject,
                template=template,
                html_template=html_template,
                project=project,
                reference=group,
                headers=headers,
                type='notify.error',
                context=context,
                send_to=[user_id],
            )

    def get_digest_subject(self, group, counts, date):
        return u'{short_id} - {count} new {noun} since {date}'.format(
            short_id=group.qualified_short_id,
            count=len(counts),
            noun='alert' if len(counts) == 1 else 'alerts',
            date=dateformat.format(date, 'N j, Y, P e'),
        )

    def render_digest_as_single_notification(self, counts, digest, users=None):
        # If there is only one group in this digest (regardless of how many
        # rules it appears in), we should just render this using the single
        # notification template. If there is more than one record for a group,
        # just choose the most recent one.
        group = six.next(iter(counts))
        record = max(
            itertools.chain.from_iterable(
                groups.get(group, []) for groups in six.itervalues(digest)
            ),
            key=lambda record: record.timestamp,
        )
        notification = Notification(record.value.event, rules=record.value.rules)
        self.notify(notification, users)

    def notify_digest(self, project, digest):
        start, end, counts = get_digest_metadata(digest)

        if len(counts) == 1:
            self.render_digest_as_single_notification(counts, digest)

        context = {
            'start': start,
            'end': end,
            'project': project,
            'digest': digest,
            'counts': counts,
        }

        headers = {
            'X-Sentry-Project': project.slug,
        }
        group = six.next(iter(counts))
        subject = self.get_digest_subject(group, counts, start)
        events = self.get_events_from_digest(digest)

        event_actors = ProjectOwnership.get_all_actors(project.id, [event[0] for event in events])
        event_users = self.event_actors_to_user_ids(event_actors)
        for user_id in self.get_send_to(project):
            events_for_user = [event for event in events if user_id in event_users[event[0]]]
            if not events_for_user:
                continue
            if len(events_for_user) != len(counts):
                context_for_user = self.build_custom_context(events_for_user, project)
            if len(events_for_user) == 1:
                self.render_digest_as_single_notification(
                    context_for_user['counts'], context_for_user['digest'], [user_id])
                continue

            self.add_unsubscribe_link(context, user_id, project)
            self._send_mail(
                subject=subject,
                template='sentry/emails/digests/body.txt',
                html_template='sentry/emails/digests/body.html',
                project=project,
                reference=project,
                headers=headers,
                type='notify.digest',
                context=context,
                send_to=[user_id],
            )

#    def event_actors_to_user_ids_2(self, event_actors):
#        """
#        Create a dictionary from user_ids to events
#        """
#        from sentry.models import Team
#        resolved_teams = self.teams_to_user_ids(event_actors)
#        user_events = {}
#        for event, actors in six.iteritems(event_actors):
#            user_ids = set()
#            for actor in actors:
#                if actor.type == Team:
        #             user_ids += resolved_teams[actor]
        #         else:
        #             user_ids.add(actor.id)
        #     event_users[event] = user_ids

        # return event_users

    def event_actors_to_user_ids(self, event_actors):
        """
        Create a dictionary from event to user_ids
        """
        from sentry.models import Team
        resolved_teams = self.teams_to_user_ids(event_actors)
        event_users = {}
        for event, actors in six.iteritems(event_actors):
            user_ids = set()
            for actor in actors:
                if actor.type == Team:
                    user_ids += resolved_teams[actor]
                else:
                    user_ids.add(actor.id)
            event_users[event] = user_ids

        return event_users

    def teams_to_user_ids(self, event_actors):
        """
        Create a dictionary of team:[user_ids]
        """
        from sentry.models import Team
        # Get Team Actors
        for event, actors in six.iteritems(event_actors):
            teams_to_resolve = set()
            for actor in actors:
                if actor.type == Team:
                    teams_to_resolve.add(actor)

        # Resolve Teams to User ids
        resolved_teams = {}
        for team in teams_to_resolve:
            users = list(User.objects.filter(
                is_active=True,
                sentry_orgmember_set__organizationmemberteam__team=team,
            ).values_list('id', flat=True))
            resolved_teams[team] = set(users)

        return resolved_teams

    def build_custom_context(self, events, project):
        records = tuple([event_to_record(event[0], event[1]) for event in events])
        digest = build_digest(project, records)
        start, end, counts = get_digest_metadata(digest)
        context = {
            'start': start,
            'end': end,
            'project': project,
            'digest': digest,
            'counts': counts,
        }
        return context

    def get_events_from_digest(self, digest):
        """
        Returns events with their corresponding rules.
        """
        events = []
        for groups in six.itervalues(digest):
            for group in groups:
                rules = groups[group][0].value.rules
                events.append((group.get_latest_event(), rules))
        return events

    def notify_about_activity(self, activity):
        email_cls = emails.get(activity.type)
        if not email_cls:
            logger.debug(
                'No email associated with activity type `{}`'.format(
                    activity.get_type_display(),
                )
            )
            return

        email = email_cls(activity)
        email.send()

    def handle_user_report(self, payload, project, **kwargs):
        from sentry.models import Group, GroupSubscription, GroupSubscriptionReason

        group = Group.objects.get(id=payload['report']['issue']['id'])

        participants = GroupSubscription.objects.get_participants(group=group)

        if not participants:
            return

        context = {
            'project': project,
            'project_link': absolute_uri('/{}/{}/'.format(
                project.organization.slug,
                project.slug,
            )),
            'issue_link': absolute_uri('/{}/{}/issues/{}/'.format(
                project.organization.slug,
                project.slug,
                payload['report']['issue']['id'],
            )),
            # TODO(dcramer): we dont have permalinks to feedback yet
            'link': absolute_uri('/{}/{}/issues/{}/feedback/'.format(
                project.organization.slug,
                project.slug,
                payload['report']['issue']['id'],
            )),
            'group': group,
            'report': payload['report'],
        }

        subject_prefix = self.get_option('subject_prefix', project) or self._subject_prefix()
        subject_prefix = force_text(subject_prefix)
        subject = force_text(u'{}{} - New Feedback from {}'.format(
            subject_prefix,
            group.qualified_short_id,
            payload['report']['name'],
        ))

        headers = {
            'X-Sentry-Project': project.slug,
        }

        # TODO(dcramer): this is copypasta'd from activity notifications
        # and while it'd be nice to re-use all of that, they are currently
        # coupled to <Activity> instances which makes this tough
        for user, reason in participants.items():
            context.update({
                'reason': GroupSubscriptionReason.descriptions.get(
                    reason,
                    "are subscribed to this issue",
                ),
                'unsubscribe_link': generate_signed_link(
                    user.id,
                    'sentry-account-email-unsubscribe-issue',
                    kwargs={'issue_id': group.id},
                ),
            })

            msg = MessageBuilder(
                subject=subject,
                template='sentry/emails/activity/new-user-feedback.txt',
                html_template='sentry/emails/activity/new-user-feedback.html',
                headers=headers,
                type='notify.user-report',
                context=context,
                reference=group,
            )
            msg.add_users([user.id], project=project)
            msg.send_async()

    def handle_signal(self, name, payload, **kwargs):
        if name == 'user-reports.created':
            self.handle_user_report(payload, **kwargs)


# Legacy compatibility
MailProcessor = MailPlugin

register(MailPlugin)
