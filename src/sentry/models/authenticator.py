from __future__ import absolute_import

import six

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from django.utils.functional import cached_property

from sentry.db.models import (
    BaseManager,
    BaseModel,
    BoundedAutoField,
    BoundedPositiveIntegerField,
    EncryptedPickledObjectField,
    FlexibleForeignKey,
)
from sentry.auth.authenticators import (
    AUTHENTICATOR_CHOICES,
    AUTHENTICATOR_INTERFACES,
    AUTHENTICATOR_INTERFACES_BY_TYPE,
    available_authenticators,
)


class AuthenticatorManager(BaseManager):
    def all_interfaces_for_user(self, user, return_missing=False, ignore_backup=False):
        """Returns a correctly sorted list of all interfaces the user
        has enabled.  If `return_missing` is set to `True` then all
        interfaces are returned even if not enabled.
        """

        def _sort(x):
            return sorted(x, key=lambda x: (x.type == 0, x.type))

        # Collect interfaces user is enrolled in
        ifaces = [
            x.interface
            for x in Authenticator.objects.filter(
                user=user,
                type__in=[a.type for a in available_authenticators(ignore_backup=ignore_backup)],
            )
        ]

        if return_missing:
            # Collect additional interfaces that the user
            # is not enrolled in
            rvm = dict(AUTHENTICATOR_INTERFACES)
            for iface in ifaces:
                rvm.pop(iface.interface_id, None)
            for iface_cls in six.itervalues(rvm):
                if iface_cls.is_available:
                    ifaces.append(iface_cls())

        return _sort(ifaces)

    def auto_add_recovery_codes(self, user, force=False):
        """This automatically adds the recovery code backup interface in
        case no backup interface is currently set for the user.  Returns
        the interface that was added.
        """
        from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface

        has_authenticators = False

        # If we're not forcing, check for a backup interface already setup
        # or if it's missing, we'll need to set it.
        if not force:
            for authenticator in Authenticator.objects.filter(
                user=user, type__in=[a.type for a in available_authenticators()]
            ):
                iface = authenticator.interface
                if iface.is_backup_interface:
                    return
                has_authenticators = True

        if has_authenticators or force:
            interface = RecoveryCodeInterface()
            interface.enroll(user)
            return interface

    def get_interface(self, user, interface_id):
        """Looks up an interface by interface ID for a user.  If the
        interface is not available but configured a
        `Authenticator.DoesNotExist` will be raised just as if the
        authenticator was not configured at all.
        """
        interface = AUTHENTICATOR_INTERFACES.get(interface_id)
        if interface is None or not interface.is_available:
            raise LookupError("No such interface %r" % interface_id)
        try:
            return Authenticator.objects.get(user=user, type=interface.type).interface
        except Authenticator.DoesNotExist:
            return interface()

    def user_has_2fa(self, user):
        """Checks if the user has any 2FA configured.
        """
        return Authenticator.objects.filter(
            user=user, type__in=[a.type for a in available_authenticators(ignore_backup=True)]
        ).exists()

    def bulk_users_have_2fa(self, user_ids):
        """Checks if a list of user ids have 2FA configured.
        Returns a dict of {<id>: <has_2fa>}
        """
        authenticators = set(
            Authenticator.objects.filter(
                user__in=user_ids,
                type__in=[a.type for a in available_authenticators(ignore_backup=True)],
            )
            .distinct()
            .values_list("user_id", flat=True)
        )
        return {id: id in authenticators for id in user_ids}


class Authenticator(BaseModel):
    __core__ = True

    id = BoundedAutoField(primary_key=True)
    user = FlexibleForeignKey("sentry.User", db_index=True)
    created_at = models.DateTimeField(_("created at"), default=timezone.now)
    last_used_at = models.DateTimeField(_("last used at"), null=True)
    type = BoundedPositiveIntegerField(choices=AUTHENTICATOR_CHOICES)
    config = EncryptedPickledObjectField()

    objects = AuthenticatorManager()

    class AlreadyEnrolled(Exception):
        pass

    class Meta:
        app_label = "sentry"
        db_table = "auth_authenticator"
        verbose_name = _("authenticator")
        verbose_name_plural = _("authenticators")
        unique_together = (("user", "type"),)

    @cached_property
    def interface(self):
        return AUTHENTICATOR_INTERFACES_BY_TYPE[self.type](self)

    def mark_used(self, save=True):
        self.last_used_at = timezone.now()
        if save:
            self.save()

    def reset_fields(self, save=True):
        self.created_at = timezone.now()
        self.last_used_at = None
        if save:
            self.save()

    def __repr__(self):
        return "<Authenticator user=%r interface=%r>" % (
            self.user.email,
            self.interface.interface_id,
        )
