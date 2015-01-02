"""
sentry.models.activity
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from django.db import models
from django.db.models import F
from django.utils import timezone

from sentry.db.models import (
    Model, BoundedPositiveIntegerField, FlexibleForeignKey, GzippedDictField,
    sane_repr
)


class Activity(Model):
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

    def send_notification(self):
        from sentry.models import User, UserOption, ProjectOption
        from sentry.utils.email import MessageBuilder, group_id_to_email

        if self.type != Activity.NOTE or not self.group:
            return

        # TODO(dcramer): some of this logic is duplicated in NotificationPlugin
        # fetch access group members
        user_id_list = set(
            User.objects.filter(
                accessgroup__projects=self.project,
                is_active=True
            ).exclude(
                id=self.user_id,
            ).values_list('id', flat=True)
        )

        if self.project.team:
            # fetch team members
            user_id_list |= set(
                u_id for u_id in self.project.team.member_set.exclude(
                    user__id=self.user_id,
                ).values_list('user', flat=True)
            )

        if not user_id_list:
            return

        disabled = set(UserOption.objects.filter(
            user__in=user_id_list,
            key='subscribe_notes',
            value=u'0',
        ).values_list('user', flat=True))

        send_to = filter(lambda u_id: u_id not in disabled, user_id_list)

        if not send_to:
            return

        author = self.user.first_name or self.user.username

        subject_prefix = ProjectOption.objects.get_value(
            self.project, 'subject_prefix', settings.EMAIL_SUBJECT_PREFIX)
        if subject_prefix:
            subject_prefix = subject_prefix.rstrip() + ' '

        subject = '%s%s' % (subject_prefix, self.group.get_email_subject())

        context = {
            'text': self.data['text'],
            'author': author,
            'group': self.group,
            'link': self.group.get_absolute_url(),
        }

        headers = {
            'X-Sentry-Reply-To': group_id_to_email(self.group.pk),
        }

        msg = MessageBuilder(
            subject=subject,
            context=context,
            template='sentry/emails/new_note.txt',
            html_template='sentry/emails/new_note.html',
            headers=headers,
            reference=self,
            reply_reference=self.group,
        )
        msg.add_users(send_to, project=self.project)
        msg.send_async()
