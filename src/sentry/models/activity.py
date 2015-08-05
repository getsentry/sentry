"""
sentry.models.activity
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import models
from django.db.models import F
from django.utils import timezone

from sentry.db.models import (
    Model, BoundedPositiveIntegerField, FlexibleForeignKey, GzippedDictField,
    sane_repr
)
from sentry.utils.http import absolute_uri


class Activity(Model):
    __core__ = False

    SET_RESOLVED = 1
    SET_UNRESOLVED = 2
    SET_MUTED = 3
    SET_PUBLIC = 4
    SET_PRIVATE = 5
    SET_REGRESSION = 6
    CREATE_ISSUE = 7
    NOTE = 8
    FIRST_SEEN = 9
    RELEASE = 10
    ASSIGNED = 11
    UNASSIGNED = 12

    TYPE = (
        # (TYPE, verb-slug)
        (SET_RESOLVED, 'set_resolved'),
        (SET_UNRESOLVED, 'set_unresolved'),
        (SET_MUTED, 'set_muted'),
        (SET_PUBLIC, 'set_public'),
        (SET_PRIVATE, 'set_private'),
        (SET_REGRESSION, 'set_regression'),
        (CREATE_ISSUE, 'create_issue'),
        (NOTE, 'note'),
        (FIRST_SEEN, 'first_seen'),
        (RELEASE, 'release'),
        (ASSIGNED, 'assigned'),
        (UNASSIGNED, 'unassigned'),
    )

    project = FlexibleForeignKey('sentry.Project')
    group = FlexibleForeignKey('sentry.Group', null=True)
    event = FlexibleForeignKey('sentry.Event', null=True)
    # index on (type, ident)
    type = BoundedPositiveIntegerField(choices=TYPE)
    ident = models.CharField(max_length=64, null=True)
    # if the user is not set, it's assumed to be the system
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True)
    datetime = models.DateTimeField(default=timezone.now)
    data = GzippedDictField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_activity'

    __repr__ = sane_repr('project_id', 'group_id', 'event_id', 'user_id',
                         'type', 'ident')

    def save(self, *args, **kwargs):
        created = bool(not self.id)

        super(Activity, self).save(*args, **kwargs)

        if not created:
            return

        # HACK: support Group.num_comments
        if self.type == Activity.NOTE:
            self.group.update(num_comments=F('num_comments') + 1)

            if self.event:
                self.event.update(num_comments=F('num_comments') + 1)

    def get_recipients(self):
        from sentry.models import UserOption

        if self.type == Activity.ASSIGNED:
            # dont email the user if they took the action
            send_to = [self.data['assignee']]

        else:
            member_set = self.project.member_set.values_list('user', flat=True)

            if not member_set:
                return []

            disabled = set(UserOption.objects.filter(
                user__in=member_set,
                key='subscribe_notes',
                value=u'0',
            ).values_list('user', flat=True))

            send_to = [u for u in member_set if u not in disabled]

        # never include the actor
        send_to = [u for u in send_to if u != self.user_id]

        return send_to

    def send_notification(self):
        from sentry.models import Release
        from sentry.utils.email import MessageBuilder, group_id_to_email

        if self.type not in (Activity.NOTE, Activity.ASSIGNED, Activity.RELEASE):
            return

        send_to = self.get_recipients()

        if not send_to:
            return

        project = self.project
        org = self.project.organization

        if self.user:
            author = self.user.first_name or self.user.username
        else:
            author = None

        subject_prefix = self.project.get_option(
            'subject_prefix', settings.EMAIL_SUBJECT_PREFIX)
        if subject_prefix:
            subject_prefix = subject_prefix.rstrip() + ' '

        if self.group:
            subject = '%s%s' % (subject_prefix, self.group.get_email_subject())
        elif self.type == Activity.RELEASE:
            subject = '%sRelease %s' % (subject_prefix, self.data['version'])
        else:
            raise NotImplementedError

        headers = {}

        context = {
            'data': self.data,
            'author': author,
            'project': self.project,
            'project_link': absolute_uri(reverse('sentry-stream', kwargs={
                'organization_slug': org.slug,
                'project_id': project.slug,
            })),
        }

        if self.group:
            headers.update({
                'X-Sentry-Reply-To': group_id_to_email(self.group.id),
            })

            context.update({
                'group': self.group,
                'link': self.group.get_absolute_url(),
            })

        # TODO(dcramer): abstract each activity email into its own helper class
        if self.type == Activity.RELEASE:
            context.update({
                'release': Release.objects.get(
                    version=self.data['version'],
                    project=project,
                ),
                'release_link': absolute_uri(reverse('sentry-release-details', kwargs={
                    'organization_slug': org.slug,
                    'project_id': project.slug,
                    'version': self.data['version'],
                })),
            })

        template_name = self.get_type_display()

        msg = MessageBuilder(
            subject=subject,
            context=context,
            template='sentry/emails/activity/{}.txt'.format(template_name),
            html_template='sentry/emails/activity/{}.html'.format(template_name),
            headers=headers,
            reference=self,
            reply_reference=self.group,
        )
        msg.add_users(send_to, project=self.project)
        msg.send_async()
