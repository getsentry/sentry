from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    sane_repr,
)
from sentry.utils.strings import truncatechars

MAX_ACTOR_LABEL_LENGTH = 64


class AuditLogEntryEvent:
    MEMBER_INVITE = 1
    MEMBER_ADD = 2
    MEMBER_ACCEPT = 3
    MEMBER_EDIT = 4
    MEMBER_REMOVE = 5
    MEMBER_JOIN_TEAM = 6
    MEMBER_LEAVE_TEAM = 7
    MEMBER_PENDING = 8

    ORG_ADD = 10
    ORG_EDIT = 11
    ORG_REMOVE = 12
    ORG_RESTORE = 13

    TEAM_ADD = 20
    TEAM_EDIT = 21
    TEAM_REMOVE = 22

    PROJECT_ADD = 30
    PROJECT_EDIT = 31
    PROJECT_REMOVE = 32
    PROJECT_SET_PUBLIC = 33
    PROJECT_SET_PRIVATE = 34
    PROJECT_REQUEST_TRANSFER = 35
    PROJECT_ACCEPT_TRANSFER = 36
    PROJECT_ENABLE = 37
    PROJECT_DISABLE = 38

    TAGKEY_REMOVE = 40

    PROJECTKEY_ADD = 50
    PROJECTKEY_EDIT = 51
    PROJECTKEY_REMOVE = 52
    PROJECTKEY_ENABLE = 53
    PROJECTKEY_DISABLE = 53

    SSO_ENABLE = 60
    SSO_DISABLE = 61
    SSO_EDIT = 62
    SSO_IDENTITY_LINK = 63

    APIKEY_ADD = 70
    APIKEY_EDIT = 71
    APIKEY_REMOVE = 72

    RULE_ADD = 80
    RULE_EDIT = 81
    RULE_REMOVE = 82

    SET_ONDEMAND = 90
    TRIAL_STARTED = 91
    PLAN_CHANGED = 92
    PLAN_CANCELLED = 93

    SERVICEHOOK_ADD = 100
    SERVICEHOOK_EDIT = 101
    SERVICEHOOK_REMOVE = 102
    SERVICEHOOK_ENABLE = 103
    SERVICEHOOK_DISABLE = 104

    INTEGRATION_UPGRADE = 109
    INTEGRATION_ADD = 110
    INTEGRATION_EDIT = 111
    INTEGRATION_REMOVE = 112

    SENTRY_APP_ADD = 113
    # SENTRY_APP_EDIT = 114
    SENTRY_APP_REMOVE = 115
    SENTRY_APP_INSTALL = 116
    SENTRY_APP_UNINSTALL = 117

    MONITOR_ADD = 120
    MONITOR_EDIT = 121
    MONITOR_REMOVE = 122

    INTERNAL_INTEGRATION_ADD = 130

    INTERNAL_INTEGRATION_ADD_TOKEN = 135
    INTERNAL_INTEGRATION_REMOVE_TOKEN = 136

    INVITE_REQUEST_ADD = 140
    INVITE_REQUEST_REMOVE = 141


class AuditLogEntry(Model):
    __core__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    actor_label = models.CharField(max_length=MAX_ACTOR_LABEL_LENGTH, null=True, blank=True)
    # if the entry was created via a user
    actor = FlexibleForeignKey(
        "sentry.User", related_name="audit_actors", null=True, blank=True, on_delete=models.SET_NULL
    )
    # if the entry was created via an api key
    actor_key = FlexibleForeignKey("sentry.ApiKey", null=True, blank=True)
    target_object = BoundedPositiveIntegerField(null=True)
    target_user = FlexibleForeignKey(
        "sentry.User",
        null=True,
        blank=True,
        related_name="audit_targets",
        on_delete=models.SET_NULL,
    )
    # TODO(dcramer): we want to compile this mapping into JSX for the UI
    event = BoundedPositiveIntegerField(
        choices=(
            # We emulate github a bit with event naming
            (AuditLogEntryEvent.MEMBER_INVITE, "member.invite"),
            (AuditLogEntryEvent.MEMBER_ADD, "member.add"),
            (AuditLogEntryEvent.MEMBER_ACCEPT, "member.accept-invite"),
            (AuditLogEntryEvent.MEMBER_REMOVE, "member.remove"),
            (AuditLogEntryEvent.MEMBER_EDIT, "member.edit"),
            (AuditLogEntryEvent.MEMBER_JOIN_TEAM, "member.join-team"),
            (AuditLogEntryEvent.MEMBER_LEAVE_TEAM, "member.leave-team"),
            (AuditLogEntryEvent.MEMBER_PENDING, "member.pending"),
            (AuditLogEntryEvent.TEAM_ADD, "team.create"),
            (AuditLogEntryEvent.TEAM_EDIT, "team.edit"),
            (AuditLogEntryEvent.TEAM_REMOVE, "team.remove"),
            (AuditLogEntryEvent.PROJECT_ADD, "project.create"),
            (AuditLogEntryEvent.PROJECT_EDIT, "project.edit"),
            (AuditLogEntryEvent.PROJECT_REMOVE, "project.remove"),
            (AuditLogEntryEvent.PROJECT_SET_PUBLIC, "project.set-public"),
            (AuditLogEntryEvent.PROJECT_SET_PRIVATE, "project.set-private"),
            (AuditLogEntryEvent.PROJECT_REQUEST_TRANSFER, "project.request-transfer"),
            (AuditLogEntryEvent.PROJECT_ACCEPT_TRANSFER, "project.accept-transfer"),
            (AuditLogEntryEvent.PROJECT_ENABLE, "project.enable"),
            (AuditLogEntryEvent.PROJECT_DISABLE, "project.disable"),
            (AuditLogEntryEvent.ORG_ADD, "org.create"),
            (AuditLogEntryEvent.ORG_EDIT, "org.edit"),
            (AuditLogEntryEvent.ORG_REMOVE, "org.remove"),
            (AuditLogEntryEvent.ORG_RESTORE, "org.restore"),
            (AuditLogEntryEvent.TAGKEY_REMOVE, "tagkey.remove"),
            (AuditLogEntryEvent.PROJECTKEY_ADD, "projectkey.create"),
            (AuditLogEntryEvent.PROJECTKEY_EDIT, "projectkey.edit"),
            (AuditLogEntryEvent.PROJECTKEY_REMOVE, "projectkey.remove"),
            (AuditLogEntryEvent.PROJECTKEY_ENABLE, "projectkey.enable"),
            (AuditLogEntryEvent.PROJECTKEY_DISABLE, "projectkey.disable"),
            (AuditLogEntryEvent.SSO_ENABLE, "sso.enable"),
            (AuditLogEntryEvent.SSO_DISABLE, "sso.disable"),
            (AuditLogEntryEvent.SSO_EDIT, "sso.edit"),
            (AuditLogEntryEvent.SSO_IDENTITY_LINK, "sso-identity.link"),
            (AuditLogEntryEvent.APIKEY_ADD, "api-key.create"),
            (AuditLogEntryEvent.APIKEY_EDIT, "api-key.edit"),
            (AuditLogEntryEvent.APIKEY_REMOVE, "api-key.remove"),
            (AuditLogEntryEvent.RULE_ADD, "rule.create"),
            (AuditLogEntryEvent.RULE_EDIT, "rule.edit"),
            (AuditLogEntryEvent.RULE_REMOVE, "rule.remove"),
            (AuditLogEntryEvent.SERVICEHOOK_ADD, "servicehook.create"),
            (AuditLogEntryEvent.SERVICEHOOK_EDIT, "servicehook.edit"),
            (AuditLogEntryEvent.SERVICEHOOK_REMOVE, "servicehook.remove"),
            (AuditLogEntryEvent.SERVICEHOOK_ENABLE, "servicehook.enable"),
            (AuditLogEntryEvent.SERVICEHOOK_DISABLE, "servicehook.disable"),
            (AuditLogEntryEvent.INTEGRATION_UPGRADE, "integration.upgrade"),
            (AuditLogEntryEvent.INTEGRATION_ADD, "integration.add"),
            (AuditLogEntryEvent.INTEGRATION_EDIT, "integration.edit"),
            (AuditLogEntryEvent.INTEGRATION_REMOVE, "integration.remove"),
            (AuditLogEntryEvent.SENTRY_APP_ADD, "sentry-app.add"),
            (AuditLogEntryEvent.SENTRY_APP_REMOVE, "sentry-app.remove"),
            (AuditLogEntryEvent.SENTRY_APP_INSTALL, "sentry-app.install"),
            (AuditLogEntryEvent.SENTRY_APP_UNINSTALL, "sentry-app.uninstall"),
            (AuditLogEntryEvent.INTERNAL_INTEGRATION_ADD, "internal-integration.create"),
            (AuditLogEntryEvent.INTERNAL_INTEGRATION_ADD_TOKEN, "internal-integration.add-token"),
            (
                AuditLogEntryEvent.INTERNAL_INTEGRATION_REMOVE_TOKEN,
                "internal-integration.remove-token",
            ),
            (AuditLogEntryEvent.SET_ONDEMAND, "ondemand.edit"),
            (AuditLogEntryEvent.TRIAL_STARTED, "trial.started"),
            (AuditLogEntryEvent.PLAN_CHANGED, "plan.changed"),
            (AuditLogEntryEvent.PLAN_CANCELLED, "plan.cancelled"),
            (AuditLogEntryEvent.INVITE_REQUEST_ADD, "invite-request.create"),
            (AuditLogEntryEvent.INVITE_REQUEST_REMOVE, "invite-request.remove"),
        )
    )
    ip_address = models.GenericIPAddressField(null=True, unpack_ipv4=True)
    data = GzippedDictField()
    datetime = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_auditlogentry"

    __repr__ = sane_repr("organization_id", "type")

    def save(self, *args, **kwargs):
        if not self.actor_label:
            assert self.actor or self.actor_key
            if self.actor:
                self.actor_label = self.actor.username
            else:
                self.actor_label = self.actor_key.key
        # trim label to the max length
        self.actor_label = self.actor_label[:MAX_ACTOR_LABEL_LENGTH]
        super().save(*args, **kwargs)

    def get_actor_name(self):
        if self.actor:
            return self.actor.get_display_name()
        elif self.actor_key:
            return self.actor_key.key + " (api key)"
        return self.actor_label

    def get_note(self):
        if self.event == AuditLogEntryEvent.MEMBER_INVITE:
            return "invited member {}".format(self.data["email"])
        elif self.event == AuditLogEntryEvent.MEMBER_ADD:
            if self.target_user == self.actor:
                return "joined the organization"
            return f"added member {self.target_user.get_display_name()}"
        elif self.event == AuditLogEntryEvent.MEMBER_ACCEPT:
            return "accepted the membership invite"
        elif self.event == AuditLogEntryEvent.MEMBER_REMOVE:
            if self.target_user == self.actor:
                return "left the organization"
            return "removed member {}".format(
                self.data.get("email") or self.target_user.get_display_name(),
            )
        elif self.event == AuditLogEntryEvent.MEMBER_EDIT:
            return "edited member {} (role: {}, teams: {})".format(
                self.data.get("email") or self.target_user.get_display_name(),
                self.data.get("role") or "N/A",
                ", ".join(str(x) for x in self.data.get("team_slugs", [])) or "N/A",
            )
        elif self.event == AuditLogEntryEvent.MEMBER_JOIN_TEAM:
            if self.target_user == self.actor:
                return "joined team {}".format(self.data["team_slug"])
            return "added {} to team {}".format(
                self.data.get("email") or self.target_user.get_display_name(),
                self.data["team_slug"],
            )
        elif self.event == AuditLogEntryEvent.MEMBER_LEAVE_TEAM:
            if self.target_user == self.actor:
                return "left team {}".format(self.data["team_slug"])
            return "removed {} from team {}".format(
                self.data.get("email") or self.target_user.get_display_name(),
                self.data["team_slug"],
            )
        elif self.event == AuditLogEntryEvent.MEMBER_PENDING:
            return "required member {} to setup 2FA".format(
                self.data.get("email") or self.target_user.get_display_name(),
            )

        elif self.event == AuditLogEntryEvent.ORG_ADD:
            return "created the organization"
        elif self.event == AuditLogEntryEvent.ORG_EDIT:
            return "edited the organization setting: " + (
                ", ".join(f"{k} {v}" for k, v in self.data.items())
            )
        elif self.event == AuditLogEntryEvent.ORG_REMOVE:
            return "removed the organization"
        elif self.event == AuditLogEntryEvent.ORG_RESTORE:
            return "restored the organization"

        elif self.event == AuditLogEntryEvent.TEAM_ADD:
            return "created team {}".format(self.data["slug"])
        elif self.event == AuditLogEntryEvent.TEAM_EDIT:
            return "edited team {}".format(self.data["slug"])
        elif self.event == AuditLogEntryEvent.TEAM_REMOVE:
            return "removed team {}".format(self.data["slug"])

        elif self.event == AuditLogEntryEvent.PROJECT_ADD:
            return "created project {}".format(self.data["slug"])
        elif self.event == AuditLogEntryEvent.PROJECT_EDIT:
            return "edited project settings " + (
                " ".join([f" in {key} to {value}" for (key, value) in self.data.items()])
            )
        elif self.event == AuditLogEntryEvent.PROJECT_REMOVE:
            return "removed project {}".format(self.data["slug"])
        elif self.event == AuditLogEntryEvent.PROJECT_REQUEST_TRANSFER:
            return "requested to transfer project {}".format(self.data["slug"])
        elif self.event == AuditLogEntryEvent.PROJECT_ACCEPT_TRANSFER:
            return "accepted transfer of project {}".format(self.data["slug"])
        elif self.event in [AuditLogEntryEvent.PROJECT_ENABLE, AuditLogEntryEvent.PROJECT_DISABLE]:
            verb = "enabled" if self.event == AuditLogEntryEvent.PROJECT_ENABLE else "disabled"

            # Most logs will just be name of the filter, but legacy browser changes can be bool, str or sets
            filter_name = self.data["state"]
            if (
                filter_name in ("0", "1")
                or isinstance(filter_name, set)
                or isinstance(filter_name, bool)
            ):
                message = f"{verb} project filter legacy-browsers"
                if isinstance(filter_name, set):
                    message += ": {}".format(", ".join(filter_name))
                return message
            else:
                return f"{verb} project filter {filter_name}"

        elif self.event == AuditLogEntryEvent.TAGKEY_REMOVE:
            return "removed tags matching {} = *".format(self.data["key"])

        elif self.event == AuditLogEntryEvent.PROJECTKEY_ADD:
            return "added project key {}".format(self.data["public_key"])
        elif self.event == AuditLogEntryEvent.PROJECTKEY_EDIT:
            return "edited project key {}".format(self.data["public_key"])
        elif self.event == AuditLogEntryEvent.PROJECTKEY_REMOVE:
            return "removed project key {}".format(self.data["public_key"])
        elif self.event == AuditLogEntryEvent.PROJECTKEY_ENABLE:
            return "enabled project key {}".format(self.data["public_key"])
        elif self.event == AuditLogEntryEvent.PROJECTKEY_DISABLE:
            return "disabled project key {}".format(self.data["public_key"])

        elif self.event == AuditLogEntryEvent.SSO_ENABLE:
            return "enabled sso ({})".format(self.data["provider"])
        elif self.event == AuditLogEntryEvent.SSO_DISABLE:
            return "disabled sso ({})".format(self.data["provider"])
        elif self.event == AuditLogEntryEvent.SSO_EDIT:
            return "edited sso settings: " + (", ".join(f"{k} {v}" for k, v in self.data.items()))
        elif self.event == AuditLogEntryEvent.SSO_IDENTITY_LINK:
            return "linked their account to a new identity"

        elif self.event == AuditLogEntryEvent.APIKEY_ADD:
            return "added api key {}".format(self.data["label"])
        elif self.event == AuditLogEntryEvent.APIKEY_EDIT:
            return "edited api key {}".format(self.data["label"])
        elif self.event == AuditLogEntryEvent.APIKEY_REMOVE:
            return "removed api key {}".format(self.data["label"])

        elif self.event == AuditLogEntryEvent.RULE_ADD:
            return 'added rule "{}"'.format(self.data["label"])
        elif self.event == AuditLogEntryEvent.RULE_EDIT:
            return 'edited rule "{}"'.format(self.data["label"])
        elif self.event == AuditLogEntryEvent.RULE_REMOVE:
            return 'removed rule "{}"'.format(self.data["label"])

        elif self.event == AuditLogEntryEvent.SET_ONDEMAND:
            if self.data["ondemand"] == -1:
                return "changed on-demand spend to unlimited"
            return "changed on-demand max spend to $%d" % (self.data["ondemand"] / 100,)
        elif self.event == AuditLogEntryEvent.TRIAL_STARTED:
            return "started trial"
        elif self.event == AuditLogEntryEvent.PLAN_CHANGED:
            return "changed plan to {}".format(self.data["plan_name"])
        elif self.event == AuditLogEntryEvent.PLAN_CANCELLED:
            return "cancelled plan"

        elif self.event == AuditLogEntryEvent.SERVICEHOOK_ADD:
            return 'added a service hook for "{}"'.format(truncatechars(self.data["url"], 64))
        elif self.event == AuditLogEntryEvent.SERVICEHOOK_EDIT:
            return 'edited the service hook for "{}"'.format(truncatechars(self.data["url"], 64))
        elif self.event == AuditLogEntryEvent.SERVICEHOOK_REMOVE:
            return 'removed the service hook for "{}"'.format(truncatechars(self.data["url"], 64))
        elif self.event == AuditLogEntryEvent.SERVICEHOOK_ENABLE:
            return 'enabled theservice hook for "{}"'.format(truncatechars(self.data["url"], 64))
        elif self.event == AuditLogEntryEvent.SERVICEHOOK_DISABLE:
            return 'disabled the service hook for "{}"'.format(truncatechars(self.data["url"], 64))

        elif self.event == AuditLogEntryEvent.INTEGRATION_ADD:
            if self.data.get("provider"):
                return "installed {} for the {} integration".format(
                    self.data["name"],
                    self.data["provider"],
                )
            else:
                return "enabled integration {} for project {}".format(
                    self.data["integration"],
                    self.data["project"],
                )
        elif self.event == AuditLogEntryEvent.INTEGRATION_EDIT:
            if self.data.get("provider"):
                return "edited the {} for the {} integration".format(
                    self.data["name"],
                    self.data["provider"],
                )
            return "edited integration {} for project {}".format(
                self.data["integration"],
                self.data["project"],
            )
        elif self.event == AuditLogEntryEvent.INTEGRATION_REMOVE:
            if self.data.get("provider"):
                return "uninstalled {} for the {} integration".format(
                    self.data["name"],
                    self.data["provider"],
                )
            return "disabled integration {} from project {}".format(
                self.data["integration"],
                self.data["project"],
            )
        elif self.event == AuditLogEntryEvent.INTEGRATION_UPGRADE:
            if self.data.get("provider"):
                return "upgraded {} for the {} integration".format(
                    self.data["name"],
                    self.data["provider"],
                )

        elif self.event == AuditLogEntryEvent.SENTRY_APP_ADD:
            return "created sentry app %s" % (self.data["sentry_app"])
        elif self.event == AuditLogEntryEvent.SENTRY_APP_REMOVE:
            return "removed sentry app %s" % (self.data["sentry_app"])
        elif self.event == AuditLogEntryEvent.SENTRY_APP_INSTALL:
            return "installed sentry app %s" % (self.data["sentry_app"])
        elif self.event == AuditLogEntryEvent.SENTRY_APP_UNINSTALL:
            return "uninstalled sentry app %s" % (self.data["sentry_app"])
        elif self.event == AuditLogEntryEvent.INTERNAL_INTEGRATION_ADD:
            return "created internal integration %s" % (self.data.get("name", ""))
        elif self.event == AuditLogEntryEvent.INTERNAL_INTEGRATION_ADD_TOKEN:
            return "created a token for internal integration %s" % (self.data["sentry_app"])
        elif self.event == AuditLogEntryEvent.INTERNAL_INTEGRATION_REMOVE_TOKEN:
            return "revoked a token for internal integration %s" % (self.data["sentry_app"])
        elif self.event == AuditLogEntryEvent.INVITE_REQUEST_ADD:
            return "request added to invite {}".format(self.data["email"])
        elif self.event == AuditLogEntryEvent.INVITE_REQUEST_REMOVE:
            return "removed the invite request for {}".format(self.data["email"])

        return ""
