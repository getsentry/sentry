import logging
import warnings

from bitfield import BitField
from django.contrib.auth.signals import user_logged_out
from django.contrib.auth.models import AbstractBaseUser, UserManager as DjangoUserManager
from django.core.urlresolvers import reverse
from django.dispatch import receiver
from django.db import IntegrityError, models, transaction
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import BaseManager, BaseModel, BoundedAutoField, FlexibleForeignKey, sane_repr
from sentry.models import LostPasswordHash
from sentry.utils.http import absolute_uri

audit_logger = logging.getLogger("sentry.audit.user")


class UserManager(BaseManager, DjangoUserManager):
    def get_from_teams(self, organization_id, teams):
        return self.filter(
            sentry_orgmember_set__organization_id=organization_id,
            sentry_orgmember_set__organizationmemberteam__team__in=teams,
            sentry_orgmember_set__organizationmemberteam__is_active=True,
            is_active=True,
        )

    def get_from_projects(self, organization_id, projects):
        """
        Returns users associated with a project based on their teams.
        """
        return self.filter(
            sentry_orgmember_set__organization_id=organization_id,
            sentry_orgmember_set__organizationmemberteam__team__projectteam__project__in=projects,
            sentry_orgmember_set__organizationmemberteam__is_active=True,
            is_active=True,
        )


class User(BaseModel, AbstractBaseUser):
    __core__ = True

    id = BoundedAutoField(primary_key=True)
    username = models.CharField(_("username"), max_length=128, unique=True)
    # this column is called first_name for legacy reasons, but it is the entire
    # display name
    name = models.CharField(_("name"), max_length=200, blank=True, db_column="first_name")
    email = models.EmailField(_("email address"), blank=True, max_length=75)
    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into this admin site."),
    )
    is_active = models.BooleanField(
        _("active"),
        default=True,
        help_text=_(
            "Designates whether this user should be treated as "
            "active. Unselect this instead of deleting accounts."
        ),
    )
    is_superuser = models.BooleanField(
        _("superuser status"),
        default=False,
        help_text=_(
            "Designates that this user has all permissions without explicitly assigning them."
        ),
    )
    is_managed = models.BooleanField(
        _("managed"),
        default=False,
        help_text=_(
            "Designates whether this user should be treated as "
            "managed. Select this to disallow the user from "
            "modifying their account (username, password, etc)."
        ),
    )
    is_sentry_app = models.NullBooleanField(
        _("is sentry app"),
        null=True,
        default=None,
        help_text=_(
            "Designates whether this user is the entity used for Permissions"
            "on behalf of a Sentry App. Cannot login or use Sentry like a"
            "normal User would."
        ),
    )
    is_password_expired = models.BooleanField(
        _("password expired"),
        default=False,
        help_text=_(
            "If set to true then the user needs to change the " "password on next sign in."
        ),
    )
    last_password_change = models.DateTimeField(
        _("date of last password change"),
        null=True,
        help_text=_("The date the password was changed last."),
    )

    flags = BitField(
        flags=(
            ("newsletter_consent_prompt", "Do we need to ask this user for newsletter consent?"),
        ),
        default=0,
        null=True,
    )

    session_nonce = models.CharField(max_length=12, null=True)
    actor = FlexibleForeignKey(
        "sentry.Actor", db_index=True, unique=True, null=True, on_delete=models.PROTECT
    )
    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)
    last_active = models.DateTimeField(_("last active"), default=timezone.now, null=True)

    objects = UserManager(cache_fields=["pk"])

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        app_label = "sentry"
        db_table = "auth_user"
        verbose_name = _("user")
        verbose_name_plural = _("users")

    __repr__ = sane_repr("id")

    def delete(self):
        if self.username == "sentry":
            raise Exception('You cannot delete the "sentry" user as it is required by Sentry.')
        avatar = self.avatar.first()
        if avatar:
            avatar.delete()
        return super().delete()

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        return super().save(*args, **kwargs)

    def has_perm(self, perm_name):
        warnings.warn("User.has_perm is deprecated", DeprecationWarning)
        return self.is_superuser

    def has_module_perms(self, app_label):
        warnings.warn("User.has_module_perms is deprecated", DeprecationWarning)
        return self.is_superuser

    def get_unverified_emails(self):
        return self.emails.filter(is_verified=False)

    def get_verified_emails(self):
        return self.emails.filter(is_verified=True)

    def has_unverified_emails(self):
        return self.get_unverified_emails().exists()

    def get_label(self):
        return self.email or self.username or self.id

    def get_display_name(self):
        return self.name or self.email or self.username

    def get_full_name(self):
        return self.name

    def get_short_name(self):
        return self.username

    def get_salutation_name(self):
        name = self.name or self.username.split("@", 1)[0].split(".", 1)[0]
        first_name = name.split(" ", 1)[0]
        return first_name.capitalize()

    def get_avatar_type(self):
        avatar = self.avatar.first()
        if avatar:
            return avatar.get_avatar_type_display()
        return "letter_avatar"

    def send_confirm_email_singular(self, email, is_new_user=False):
        from sentry import options
        from sentry.utils.email import MessageBuilder

        if not email.hash_is_valid():
            email.set_hash()
            email.save()

        context = {
            "user": self,
            "url": absolute_uri(
                reverse("sentry-account-confirm-email", args=[self.id, email.validation_hash])
            ),
            "confirm_email": email.email,
            "is_new_user": is_new_user,
        }
        msg = MessageBuilder(
            subject="{}Confirm Email".format(options.get("mail.subject-prefix")),
            template="sentry/emails/confirm_email.txt",
            html_template="sentry/emails/confirm_email.html",
            type="user.confirm_email",
            context=context,
        )
        msg.send_async([email.email])

    def send_confirm_emails(self, is_new_user=False):
        email_list = self.get_unverified_emails()
        for email in email_list:
            self.send_confirm_email_singular(email, is_new_user)

    def merge_to(from_user, to_user):
        # TODO: we could discover relations automatically and make this useful
        from sentry import roles
        from sentry.models import (
            Activity,
            AuditLogEntry,
            AuthIdentity,
            Authenticator,
            GroupAssignee,
            GroupBookmark,
            GroupSeen,
            GroupShare,
            GroupSubscription,
            Identity,
            OrganizationMember,
            OrganizationMemberTeam,
            UserAvatar,
            UserEmail,
            UserOption,
        )

        audit_logger.info(
            "user.merge", extra={"from_user_id": from_user.id, "to_user_id": to_user.id}
        )

        for obj in OrganizationMember.objects.filter(user=from_user):
            try:
                with transaction.atomic():
                    obj.update(user=to_user)
            # this will error if both users are members of obj.org
            except IntegrityError:
                pass

            # identify the highest priority membership
            # only applies if both users are members of obj.org
            # if roles are different, grants combined user the higher of the two
            to_member = OrganizationMember.objects.get(
                organization=obj.organization_id, user=to_user
            )
            if roles.get(obj.role).priority > roles.get(to_member.role).priority:
                to_member.update(role=obj.role)

            for team in obj.teams.all():
                try:
                    with transaction.atomic():
                        OrganizationMemberTeam.objects.create(
                            organizationmember=to_member, team=team
                        )
                # this will error if both users are on the same team in obj.org,
                # in which case, no need to update anything
                except IntegrityError:
                    pass

        model_list = (
            Authenticator,
            GroupAssignee,
            GroupBookmark,
            GroupSeen,
            GroupShare,
            GroupSubscription,
            Identity,
            UserAvatar,
            UserEmail,
            UserOption,
        )

        for model in model_list:
            for obj in model.objects.filter(user=from_user):
                try:
                    with transaction.atomic():
                        obj.update(user=to_user)
                except IntegrityError:
                    pass

        Activity.objects.filter(user=from_user).update(user=to_user)
        # users can be either the subject or the object of actions which get logged
        AuditLogEntry.objects.filter(actor=from_user).update(actor=to_user)
        AuditLogEntry.objects.filter(target_user=from_user).update(target_user=to_user)

        # remove any SSO identities that exist on from_user that might conflict
        # with to_user's existing identities (only applies if both users have
        # SSO identities in the same org), then pass the rest on to to_user
        AuthIdentity.objects.filter(
            user=from_user,
            auth_provider__organization__in=AuthIdentity.objects.filter(user=to_user).values(
                "auth_provider__organization"
            ),
        ).delete()
        AuthIdentity.objects.filter(user=from_user).update(user=to_user)

    def set_password(self, raw_password):
        super().set_password(raw_password)
        self.last_password_change = timezone.now()
        self.is_password_expired = False

    def refresh_session_nonce(self, request=None):
        from django.utils.crypto import get_random_string

        self.session_nonce = get_random_string(12)
        if request is not None:
            request.session["_nonce"] = self.session_nonce

    def get_orgs(self):
        from sentry.models import Organization, OrganizationMember, OrganizationStatus

        return Organization.objects.filter(
            status=OrganizationStatus.VISIBLE,
            id__in=OrganizationMember.objects.filter(user=self).values("organization"),
        )

    def get_projects(self):
        from sentry.models import Project, ProjectStatus, ProjectTeam, OrganizationMemberTeam

        return Project.objects.filter(
            status=ProjectStatus.VISIBLE,
            id__in=ProjectTeam.objects.filter(
                team_id__in=OrganizationMemberTeam.objects.filter(
                    organizationmember__user=self
                ).values_list("team_id", flat=True)
            ).values_list("project_id", flat=True),
        )

    def get_orgs_require_2fa(self):
        from sentry.models import Organization, OrganizationStatus

        return Organization.objects.filter(
            flags=models.F("flags").bitor(Organization.flags.require_2fa),
            status=OrganizationStatus.VISIBLE,
            member_set__user=self,
        )

    def clear_lost_passwords(self):
        LostPasswordHash.objects.filter(user=self).delete()


# HACK(dcramer): last_login needs nullable for Django 1.8
User._meta.get_field("last_login").null = True


# When a user logs out, we want to always log them out of all
# sessions and refresh their nonce.
@receiver(user_logged_out, sender=User)
def refresh_user_nonce(sender, request, user, **kwargs):
    if user is None:
        return
    user.refresh_session_nonce()
    user.save(update_fields=["session_nonce"])
