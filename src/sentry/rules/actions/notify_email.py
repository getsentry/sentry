"""
Used for notifying a *specific* plugin
"""
from __future__ import absolute_import

from django import forms

from sentry.db.models.fields.bounded import BoundedBigIntegerField

# from sentry.plugins.base import plugins
from sentry.rules.actions.base import EventAction

# from sentry.rules.actions.services import PluginService, SentryAppService
# from sentry.models import SentryApp
# from sentry.utils.safe import safe_execute

# Mail import
import itertools
import logging
import six

# from enum import Enum

# from django.core.urlresolvers import reverse
from django.utils import dateformat
from django.utils.encoding import force_text
from django.utils.safestring import mark_safe

from sentry import options
from sentry.models import ProjectOwnership, User, Team

from sentry.digests.utilities import get_digest_metadata, get_personalized_digests
from sentry.plugins.base.structs import Notification
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.committers import get_serialized_event_file_committers
from sentry.utils.email import MessageBuilder, group_id_to_email

# from sentry.utils.http import absolute_uri
from sentry.utils.linksign import generate_signed_link

# from sentry.plugins.sentry_mail.activity import emails

# Mail import

# Mail
NOTSET = object()

logger = logging.getLogger(__name__)
# Mail

# TargetType = Enum('TargetType', 'owners team member')
OWNERS = "Owners"
TEAM = "Team"
MEMBER = "Member"
CHOICES = [(OWNERS, "Owners"), (TEAM, "Team"), (MEMBER, "Member")]


class NotifyEmailForm(forms.Form):
    targetType = forms.ChoiceField(choices=CHOICES)
    targetIdentifier = BoundedBigIntegerField().formfield(required=False)


class NotifyEmailAction(EventAction):
    form_cls = NotifyEmailForm
    label = "Send an email to {targetType}"

    def __init__(self, *args, **kwargs):
        super(NotifyEmailAction, self).__init__(*args, **kwargs)
        self.form_fields = {"targetType": {"type": "mailAction", "choices": CHOICES}}

    def after(self, event, state):
        extra = {"event_id": event.event_id}
        plugin = MailPlugin()
        if not plugin.is_enabled(self.project):
            extra["project_id"] = self.project.id
            self.logger.info("rules.fail.is_enabled", extra=extra)
            return

        group = event.group

        if not plugin.should_notify(group=group, event=event):
            extra["group_id"] = group.id
            self.logger.info("rule.fail.should_notify", extra=extra)
            return

        metrics.incr("notifications.sent", instance=plugin.slug, skip_internal=False)
        yield self.future(
            lambda event, futures: plugin.rule_notify(
                event, futures, self.data.targetType, self.data.get("targetIdentifier", None)
            )
        )

    def get_form_instance(self):
        return self.form_cls(self.data)


class MailPlugin(NotificationPlugin):
    # title = "Mail"
    conf_key = "mail"
    # slug = "mail"
    # version = sentry.VERSION
    # author = "Sentry Team"
    # author_url = "https://github.com/getsentry/sentry"
    project_default_enabled = True
    project_conf_form = None
    subject_prefix = None

    def rule_notify(self, event, futures, target_type, target_identifier=None):
        from sentry.models import ProjectOption
        from sentry.tasks.digests import deliver_digest
        from sentry.digests import get_option_key as get_digest_option_key
        from sentry.digests.notifications import event_to_record, unsplit_key
        from sentry import digests

        # TODO(Jeff): Why did we remove rate limits

        rules = []
        extra = {"event_id": event.event_id, "group_id": event.group_id, "plugin": self.slug}
        log_event = "dispatched"
        for future in futures:
            rules.append(future.rule)
            extra["rule_id"] = future.rule.id
            if not future.kwargs:
                continue
            raise NotImplementedError(
                "The default behavior for notification de-duplication does not support args"
            )

        project = event.group.project
        extra["project_id"] = project.id
        """
        TODO: (jeff) look into decoupling digests from plugins, see (src/sentry/tasks/digests.py),
        (src/sentry/digests/notifications.py)
        """
        if hasattr(self, "notify_digest") and digests.enabled(project):

            def get_digest_option(key):
                return ProjectOption.objects.get_value(
                    project, get_digest_option_key(self.get_conf_key(), key)
                )

            digest_key = unsplit_key(self, event.group.project)
            extra["digest_key"] = digest_key
            immediate_delivery = digests.add(
                digest_key,
                event_to_record(event, rules),
                increment_delay=get_digest_option("increment_delay"),
                maximum_delay=get_digest_option("maximum_delay"),
            )
            if immediate_delivery:
                deliver_digest.delay(digest_key)
            else:
                log_event = "digested"

        else:
            notification = Notification(event=event, rules=rules)
            self.notify(notification, target_type, target_identifier)

        self.logger.info("notification.%s" % log_event, extra=extra)

    def _subject_prefix(self):
        if self.subject_prefix is not None:
            return self.subject_prefix
        return options.get("mail.subject-prefix")

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
        type=None,
    ):
        # if send_to is None:
        #     send_to = self.get_send_to(project)
        if not send_to:
            logger.debug("Skipping message rendering, no users to send to.")
            return

        subject_prefix = self.get_option("subject_prefix", project) or self._subject_prefix()
        subject_prefix = force_text(subject_prefix)
        subject = force_text(subject)

        msg = MessageBuilder(
            subject="%s%s" % (subject_prefix, subject),
            template=template,
            html_template=html_template,
            body=body,
            headers=headers,
            type=type,
            context=context,
            reference=reference,
            reply_reference=reply_reference,
        )
        # add_users(send_to : user_id, project: project)
        msg.add_users(send_to, project=project)
        return msg

    def _send_mail(self, *args, **kwargs):
        message = self._build_message(*args, **kwargs)
        if message is not None:
            return message.send_async()

    # def get_notification_settings_url(self):
    #     return absolute_uri(reverse("sentry-account-settings-notifications"))
    #
    # def get_project_url(self, project):
    #     return absolute_uri(u"/{}/{}/".format(project.organization.slug, project.slug))
    #
    # def is_configured(self, project, **kwargs):
    #     # Nothing to configure here
    #     return True

    def should_notify(self, group, event):
        send_to = self.get_sendable_users(group.project)
        if not send_to:
            return False

        return super(MailPlugin, self).should_notify(group, event)

    # TODO: Maybe this should shift into the action.
    def get_send_to(self, project, target_type, target_identifier=None, event=None):
        """
        Returns a list of user IDs for the users that should receive
        notifications for the provided project.

        This result may come from cached data.
        """

        def return_set(xs):
            return set(xs) if xs or xs == 0 else set()

        if not (project and project.teams.exists()):
            logger.debug("Tried to send notification to invalid project: %r", project)
            return set()
        # TODO(jeff): check if notification.event can be None

        if not event:
            return return_set(self.get_send_to_all_in_project(project))

        send_to = []
        if target_type == "Owners":
            send_to = self.get_send_to_owners(event, project)
        elif target_type == "Member":
            send_to = self.get_send_to_member(project, target_identifier)
        elif target_type == "Team":
            send_to = self.get_send_to_team(target_identifier)
        return return_set(send_to)

    def get_send_to_owners(self, event, project):
        owners, _ = ProjectOwnership.get_owners(project.id, event.data)
        if owners != ProjectOwnership.Everyone:
            if not owners:
                metrics.incr(
                    "features.owners.send_to",
                    tags={"organization": project.organization_id, "outcome": "empty"},
                    skip_internal=True,
                )
                return set()

            metrics.incr(
                "features.owners.send_to",
                tags={"organization": project.organization_id, "outcome": "match"},
                skip_internal=True,
            )
            send_to_list = set()
            teams_to_resolve = set()
            for owner in owners:
                if owner.type == User:
                    send_to_list.add(owner.id)
                else:
                    teams_to_resolve.add(owner.id)

            # get all users in teams
            if teams_to_resolve:
                send_to_list |= set(
                    User.objects.filter(
                        is_active=True,
                        sentry_orgmember_set__organizationmemberteam__team__id__in=teams_to_resolve,
                    ).values_list("id", flat=True)
                )

            alert_settings = project.get_member_alert_settings(self.alert_option_key)
            disabled_users = set(user for user, setting in alert_settings.items() if setting == 0)
            return send_to_list - disabled_users
        else:
            return self.get_send_to_all_in_project(project)

    @staticmethod
    def get_send_to_team(target_identifier):
        if target_identifier is None:
            return []
        try:
            team = Team.objects.get(id=int(target_identifier))
        except Team.DoesNotExist:
            return []
        return team.member_set.values_list("user_id", flat=True)

    @staticmethod
    def get_send_to_member(project, target_identifier):
        if target_identifier is None:
            return []
        try:
            user = User.objects.get(id=int(target_identifier))
        except User.DoesNotExist:
            # TODO(jeff): consider throwing an error?
            return []
        alert_settings = project.get_member_alert_settings("mail:alert")
        disabled_users = set(user_id for user_id, setting in alert_settings.items() if setting == 0)
        if user.id not in disabled_users:
            return [user.id]

    def get_send_to_all_in_project(self, project):
        metrics.incr(
            "features.owners.send_to",
            tags={"organization": project.organization_id, "outcome": "everyone"},
            skip_internal=True,
        )
        cache_key = "%s:send_to:%s" % (self.get_conf_key(), project.pk)
        send_to_list = cache.get(cache_key)
        if send_to_list is None:
            send_to_list = [s for s in self.get_sendable_users(project) if s]
            cache.set(cache_key, send_to_list, 60)  # 1 minute cache
        return send_to_list

    def add_unsubscribe_link(self, context, user_id, project, referrer):
        context["unsubscribe_link"] = generate_signed_link(
            user_id,
            "sentry-account-email-unsubscribe-project",
            referrer,
            kwargs={"project_id": project.id},
        )

    def notify(self, notification, target_type, target_identifier=None, **kwargs):
        from sentry.models import Commit, Release

        event = notification.event

        environment = event.get_tag("environment")

        group = event.group
        project = group.project
        org = group.organization

        subject = event.get_email_subject()

        query_params = {"referrer": "alert_email"}
        if environment:
            query_params["environment"] = environment
        link = group.get_absolute_url(params=query_params)

        template = "sentry/emails/error.txt"
        html_template = "sentry/emails/error.html"

        rules = []
        for rule in notification.rules:
            rule_link = "/settings/%s/projects/%s/alerts/rules/%s/" % (
                org.slug,
                project.slug,
                rule.id,
            )

            rules.append((rule.label, rule_link))

        enhanced_privacy = org.flags.enhanced_privacy

        # lets identify possibly suspect commits and owners
        commits = {}
        try:
            committers = get_serialized_event_file_committers(project, event)
        except (Commit.DoesNotExist, Release.DoesNotExist):
            pass
        except Exception as exc:
            logging.exception(six.text_type(exc))
        else:
            for committer in committers:
                for commit in committer["commits"]:
                    if commit["id"] not in commits:
                        commit_data = commit.copy()
                        commit_data["shortId"] = commit_data["id"][:7]
                        commit_data["author"] = committer["author"]
                        commit_data["subject"] = commit_data["message"].split("\n", 1)[0]
                        commits[commit["id"]] = commit_data

        context = {
            "project_label": project.get_full_name(),
            "group": group,
            "event": event,
            "link": link,
            "rules": rules,
            "enhanced_privacy": enhanced_privacy,
            "commits": sorted(commits.values(), key=lambda x: x["score"], reverse=True),
            "environment": environment,
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

            context.update({"tags": event.tags, "interfaces": interface_list})

        headers = {
            "X-Sentry-Logger": group.logger,
            "X-Sentry-Logger-Level": group.get_level_display(),
            "X-Sentry-Project": project.slug,
            "X-Sentry-Reply-To": group_id_to_email(group.id),
        }

        for user_id in self.get_send_to(
            project=project,
            target_type=target_type,
            target_identifier=target_identifier,
            event=event,
        ):
            self.add_unsubscribe_link(context, user_id, project, "alert_email")

            self._send_mail(
                subject=subject,
                template=template,
                html_template=html_template,
                project=project,
                reference=group,
                headers=headers,
                type="notify.error",
                context=context,
                send_to=[user_id],
            )

    def get_digest_subject(self, group, counts, date):
        return u"{short_id} - {count} new {noun} since {date}".format(
            short_id=group.qualified_short_id,
            count=len(counts),
            noun="alert" if len(counts) == 1 else "alerts",
            date=dateformat.format(date, "N j, Y, P e"),
        )

    # TODO(Jeff): Not required, but there is a dependency on mail plugin due to the way we send digests (sent key will
    #  be used to instantiate the MailPlugin to handle the notifyDigest call)
    # TODO(Jeff): How do we supply the additional argument (target_id) to digest?
    def notify_digest(self, project, digest, target_type, target_identifier=None):
        user_ids = self.get_send_to(project, target_type, target_identifier)
        for user_id, digest in get_personalized_digests(project.id, digest, user_ids):
            start, end, counts = get_digest_metadata(digest)

            # If there is only one group in this digest (regardless of how many
            # rules it appears in), we should just render this using the single
            # notification template. If there is more than one record for a group,
            # just choose the most recent one.
            if len(counts) == 1:
                group = six.next(iter(counts))
                record = max(
                    itertools.chain.from_iterable(
                        groups.get(group, []) for groups in six.itervalues(digest)
                    ),
                    key=lambda record: record.timestamp,
                )
                notification = Notification(record.value.event, rules=record.value.rules)
                return self.notify(notification, target_type, target_identifier)

            context = {
                "start": start,
                "end": end,
                "project": project,
                "digest": digest,
                "counts": counts,
            }

            headers = {"X-Sentry-Project": project.slug}

            group = six.next(iter(counts))
            subject = self.get_digest_subject(group, counts, start)

            self.add_unsubscribe_link(context, user_id, project, "alert_digest")
            self._send_mail(
                subject=subject,
                template="sentry/emails/digests/body.txt",
                html_template="sentry/emails/digests/body.html",
                project=project,
                reference=project,
                headers=headers,
                type="notify.digest",
                context=context,
                send_to=[user_id],
            )
