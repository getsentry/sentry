"""
Used for notifying via email
"""
from __future__ import absolute_import

import itertools
import logging
import six

from django import forms
from django.utils import dateformat
from django.utils.encoding import force_text
from django.utils.safestring import mark_safe

from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.digests.utilities import get_digest_metadata, get_personalized_digests
from sentry.models import ProjectOwnership, User, Team
from sentry.plugins.base.structs import Notification
from sentry.plugins.sentry_mail.models import MailPlugin
from sentry.rules.actions.base import EventAction
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.committers import get_serialized_event_file_committers
from sentry.utils.email import MessageBuilder, group_id_to_email
from sentry.utils.linksign import generate_signed_link

from enum import Enum


class NotifyEmailActionTargetType(Enum):
    ISSUE_OWNERS = "IssueOwners"
    TEAM = "Team"
    MEMBER = "Member"


CHOICES = [
    (NotifyEmailActionTargetType.ISSUE_OWNERS.value, "Issue Owners"),
    (NotifyEmailActionTargetType.TEAM.value, "Team"),
    (NotifyEmailActionTargetType.MEMBER.value, "Member"),
]


class MailAdapter(object):
    """
    Adapter for the `MailPlugin`. This class attempts to decouple `MailPlugin` from the email notification question.
    On complete decoupling, consider renaming this class to `MailProcessor`

    Logic that was used solely for sending mail notifications is extracted into this class.

    We want the mail behaviours in the `MailAdapter` to be as similar as possible to the `MailPlugin`.
    Thus, keys are still fetched from the `MailPlugin` as they are used to access project options for mail.
    Essentially, we still treat MailPlugin as a source of truth for keys.
    """

    project_default_enabled = True
    project_conf_form = None
    logger = logging.getLogger("sentry.notify_email_action.MailAdapter")
    legacy_mail = MailPlugin()

    def rule_notify(self, event, futures, target_type, target_identifier=None):
        from sentry.models import ProjectOption
        from sentry.tasks.digests import deliver_digest
        from sentry.digests import get_option_key as get_digest_option_key
        from sentry.digests.notifications import event_to_record, unsplit_key_for_targeted_action
        from sentry import digests

        # TODO(Jeff): Why did we remove rate limits

        rules = []
        extra = {
            "event_id": event.event_id,
            "group_id": event.group_id,
            "is_from_mail_action_adapter": True,
        }
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

        if digests.enabled(project):

            def get_digest_option(key):
                return ProjectOption.objects.get_value(
                    project, get_digest_option_key(self.legacy_mail.get_conf_key(), key)
                )

            digest_key = unsplit_key_for_targeted_action(
                event.group.project, target_type, target_identifier
            )
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
        if not send_to:
            self.logger.debug("Skipping message rendering, no users to send to.")
            return

        subject_prefix = (
            self.legacy_mail.get_option("subject_prefix", project)
            or self.legacy_mail._subject_prefix()
        )
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
        msg.add_users(send_to, project=project)
        return msg

    def _send_mail(self, *args, **kwargs):
        message = self._build_message(*args, **kwargs)
        if message is not None:
            return message.send_async()

    def get_sendable_users(self, project):
        """
             Return a collection of user IDs that are eligible to receive
             notifications for the provided project.
             """
        return project.get_notification_recipients(self.legacy_mail.alert_option_key)

    def should_notify(self, group):
        send_to = self.get_sendable_users(group.project)
        if not send_to:
            return False

        if not group.is_unresolved():
            return False

        # No rate limit checks needed as mail should be throttled due to digests.
        return True

    # TODO: Maybe this should shift into the action.
    def get_send_to(self, project, target_type, target_identifier=None, event=None):
        """
        Returns a list of user IDs for the users that should receive
        notifications for the provided project.

        This result may come from cached data.
        """

        def return_set(xs):
            if isinstance(xs, set):
                return xs
            return set(xs) if xs or xs == 0 else set()

        if not (project and project.teams.exists()):
            self.logger.debug("Tried to send notification to invalid project: %r", project)
            return set()
        # TODO(jeff): check if notification.event can be None

        if not event:
            return return_set(self.get_send_to_all_in_project(project))

        send_to = []
        if target_type == NotifyEmailActionTargetType.ISSUE_OWNERS.value:
            send_to = self.get_send_to_owners(event, project)
        elif target_type == NotifyEmailActionTargetType.MEMBER.value:
            send_to = self.get_send_to_member(target_identifier)
        elif target_type == NotifyEmailActionTargetType.TEAM.value:
            send_to = self.get_send_to_team(project, target_identifier)
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
            send_to_set = set()
            teams_to_resolve = set()
            for owner in owners:
                if owner.type == User:
                    send_to_set.add(owner.id)
                else:
                    teams_to_resolve.add(owner.id)

            # get all users in teams
            if teams_to_resolve:
                send_to_set |= set(
                    User.objects.filter(
                        is_active=True,
                        sentry_orgmember_set__organizationmemberteam__team__id__in=teams_to_resolve,
                    ).values_list("id", flat=True)
                )

            return send_to_set - self.disabled_users_from_project(project)
        else:
            return self.get_send_to_all_in_project(project)

    def disabled_users_from_project(self, project):
        alert_settings = project.get_member_alert_settings(self.legacy_mail.alert_option_key)
        disabled_users = set(user for user, setting in alert_settings.items() if setting == 0)
        return disabled_users

    def get_send_to_team(self, project, target_identifier):
        # TODO(Jeff): need to implement filtering based on user mail options
        if target_identifier is None:
            return []
        try:
            team = Team.objects.get(id=int(target_identifier))
        except Team.DoesNotExist:
            return []
        return set(
            team.member_set.values_list("user_id", flat=True)
        ) - self.disabled_users_from_project(project)

    @staticmethod
    def get_send_to_member(target_identifier):
        if target_identifier is None:
            return []
        try:
            user = User.objects.get(id=int(target_identifier))
        except User.DoesNotExist:
            # TODO(jeff): consider throwing an error?
            return []
        return [user.id]

    def get_send_to_all_in_project(self, project):
        metrics.incr(
            "features.owners.send_to",
            tags={"organization": project.organization_id, "outcome": "everyone"},
            skip_internal=True,
        )
        cache_key = "%s:send_to:%s" % (self.legacy_mail.get_conf_key(), project.pk)
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


class NotifyEmailForm(forms.Form):
    targetType = forms.ChoiceField(choices=CHOICES)
    targetIdentifier = BoundedBigIntegerField().formfield(
        required=False, help_text="Only required if 'Member' or 'Team' is selected"
    )

    def clean(self):
        cleaned_data = super(NotifyEmailForm, self).clean()
        # TODO(jeff): Change case
        targetType = cleaned_data.get("targetType")
        targetIdentifier = cleaned_data.get("targetIdentifier")

        if targetType == NotifyEmailActionTargetType.ISSUE_OWNERS.value:
            self.cleaned_data["targetType"] = targetType
            return

        if targetIdentifier is None:
            msg = forms.ValidationError("You need to specify a Team or Member to send a mail to.")
            self.add_error("targetIdentifier", msg)
            return

        self.cleaned_data["targetType"] = targetType
        self.cleaned_data["targetIdentifier"] = targetIdentifier
        return


class NotifyEmailAction(EventAction):
    form_cls = NotifyEmailForm
    label = "Send an email to {targetType}"
    metrics_slug = "EmailAction"
    mail_adapter = MailAdapter()

    def __init__(self, *args, **kwargs):
        super(NotifyEmailAction, self).__init__(*args, **kwargs)
        self.form_fields = {"targetType": {"type": "mailAction", "choices": CHOICES}}

    def after(self, event, state):
        extra = {"event_id": event.event_id}

        group = event.group

        if not self.mail_adapter.should_notify(group=group):
            extra["group_id"] = group.id
            self.logger.info("rule.fail.should_notify", extra=extra)
            return

        metrics.incr("notifications.sent", instance=self.metrics_slug, skip_internal=False)
        yield self.future(
            lambda event, futures: self.mail_adapter.rule_notify(
                event, futures, self.data["targetType"], self.data.get("targetIdentifier", None)
            )
        )

    def get_form_instance(self):
        return self.form_cls(self.data)
