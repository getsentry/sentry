from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils.html import escape, mark_safe
from six.moves.urllib.parse import urlparse, urlunparse

from sentry import options
from sentry.models import (
    GroupSubscription,
    GroupSubscriptionReason,
    ProjectOption,
    UserAvatar,
    UserOption,
)
from sentry.utils.assets import get_asset_url
from sentry.utils.avatar import get_email_avatar
from sentry.utils.email import MessageBuilder, group_id_to_email
from sentry.utils.http import absolute_uri
from sentry.utils.linksign import generate_signed_link


class ActivityEmail(object):
    def __init__(self, activity):
        self.activity = activity
        self.project = activity.project
        self.organization = self.project.organization
        self.group = activity.group

    def _get_subject_prefix(self):
        prefix = ProjectOption.objects.get_value(project=self.project, key="mail:subject_prefix")
        if not prefix:
            prefix = options.get("mail.subject-prefix")
        return prefix

    def should_email(self):
        return True

    def get_participants(self):
        # TODO(dcramer): not used yet today except by Release's
        if not self.group:
            return []

        participants = GroupSubscription.objects.get_participants(group=self.group)

        if self.activity.user is not None and self.activity.user in participants:
            receive_own_activity = (
                UserOption.objects.get_value(
                    user=self.activity.user, key="self_notifications", default="0"
                )
                == "1"
            )

            if not receive_own_activity:
                del participants[self.activity.user]

        return participants

    def get_template(self):
        return "sentry/emails/activity/generic.txt"

    def get_html_template(self):
        return "sentry/emails/activity/generic.html"

    def get_project_link(self):
        return absolute_uri(u"/{}/{}/".format(self.organization.slug, self.project.slug))

    def get_group_link(self):
        referrer = self.__class__.__name__
        return self.group.get_absolute_url(params={"referrer": referrer})

    def get_base_context(self):
        activity = self.activity

        context = {
            "data": activity.data,
            "author": activity.user,
            "project": self.project,
            "project_link": self.get_project_link(),
        }
        if activity.group:
            context.update(self.get_group_context())
        return context

    def get_group_context(self):
        group_link = self.get_group_link()
        parts = list(urlparse(group_link))
        parts[2] = parts[2].rstrip("/") + "/activity/"
        activity_link = urlunparse(parts)

        return {
            "group": self.group,
            "link": group_link,
            "activity_link": activity_link,
            "referrer": self.__class__.__name__,
        }

    def get_email_type(self):
        return u"notify.activity.{}".format(self.activity.get_type_display())

    def get_subject(self):
        group = self.group

        return u"%s - %s" % (group.qualified_short_id, group.title)

    def get_subject_with_prefix(self):
        return u"{}{}".format(self._get_subject_prefix(), self.get_subject()).encode("utf-8")

    def get_context(self):
        description = self.get_description()
        try:
            description, params, html_params = description
        except ValueError:
            try:
                description, params = description
                html_params = params
            except ValueError:
                params, html_params = {}, {}

        return {
            "activity_name": self.get_activity_name(),
            "text_description": self.description_as_text(description, params),
            "html_description": self.description_as_html(description, html_params),
        }

    def get_user_context(self, user):
        # use in case context of email changes depending on user
        return {}

    def get_headers(self):
        project = self.project
        group = self.group

        headers = {"X-Sentry-Project": project.slug}

        if group:
            headers.update(
                {
                    "X-Sentry-Logger": group.logger,
                    "X-Sentry-Logger-Level": group.get_level_display(),
                    "X-Sentry-Reply-To": group_id_to_email(group.id),
                }
            )

        return headers

    def get_description(self):
        raise NotImplementedError

    def avatar_as_html(self):
        user = self.activity.user
        if not user:
            return u'<img class="avatar" src="{}" width="20px" height="20px" />'.format(
                escape(self._get_sentry_avatar_url())
            )
        avatar_type = user.get_avatar_type()
        if avatar_type == "upload":
            return u'<img class="avatar" src="{}" />'.format(
                escape(self._get_user_avatar_url(user))
            )
        elif avatar_type == "letter_avatar":
            return get_email_avatar(user.get_display_name(), user.get_label(), 20, False)
        else:
            return get_email_avatar(user.get_display_name(), user.get_label(), 20, True)

    def _get_sentry_avatar_url(self):
        url = "/images/sentry-email-avatar.png"
        return absolute_uri(get_asset_url("sentry", url))

    def _get_user_avatar_url(self, user, size=20):
        try:
            avatar = UserAvatar.objects.get(user=user)
        except UserAvatar.DoesNotExist:
            return ""

        url = reverse("sentry-user-avatar-url", args=[avatar.ident])
        if size:
            url = u"{}?s={}".format(url, int(size))
        return absolute_uri(url)

    def description_as_text(self, description, params):
        user = self.activity.user
        if user:
            name = user.name or user.email
        else:
            name = u"Sentry"

        context = {"author": name, "an issue": u"an issue"}
        context.update(params)

        return description.format(**context)

    def description_as_html(self, description, params):
        user = self.activity.user
        if user:
            name = user.get_display_name()
        else:
            name = "Sentry"

        fmt = u'<span class="avatar-container">{}</span> <strong>{}</strong>'

        author = mark_safe(fmt.format(self.avatar_as_html(), escape(name)))

        an_issue = u'<a href="{}">an issue</a>'.format(escape(self.get_group_link()))

        context = {"author": author, "an issue": an_issue}
        context.update(params)

        return mark_safe(description.format(**context))

    def send(self):
        if not self.should_email():
            return

        participants = self.get_participants()
        if not participants:
            return

        activity = self.activity
        project = self.project
        group = self.group

        context = self.get_base_context()
        context.update(self.get_context())

        template = self.get_template()
        html_template = self.get_html_template()
        email_type = self.get_email_type()
        headers = self.get_headers()

        for user, reason in participants.items():
            if group:
                context.update(
                    {
                        "reason": GroupSubscriptionReason.descriptions.get(
                            reason, "are subscribed to this issue"
                        ),
                        "unsubscribe_link": generate_signed_link(
                            user.id,
                            "sentry-account-email-unsubscribe-issue",
                            kwargs={"issue_id": group.id},
                        ),
                    }
                )
            user_context = self.get_user_context(user)
            if user_context:
                user_context.update(context)
            else:
                user_context = context

            msg = MessageBuilder(
                subject=self.get_subject_with_prefix(),
                template=template,
                html_template=html_template,
                headers=headers,
                type=email_type,
                context=user_context,
                reference=activity,
                reply_reference=group,
            )
            msg.add_users([user.id], project=project)
            msg.send_async()
