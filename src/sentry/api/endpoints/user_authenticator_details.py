from __future__ import absolute_import

from django.db import transaction
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.permissions import SuperuserPermission
from sentry.models import Authenticator
from sentry.security import capture_security_activity


class UserAuthenticatorDetailsEndpoint(UserEndpoint):
    # XXX(dcramer): this requires superuser until we sort out how it will be
    # used from the React app (which will require some kind of double
    # verification)
    permission_classes = (SuperuserPermission,)

    def delete(self, request, user, auth_id):
        try:
            authenticator = Authenticator.objects.get(
                user=user,
                id=auth_id,
            )
        except Authenticator.DoesNotExist:
            return Response(status=404)

        with transaction.atomic():
            authenticator.delete()

            # if we delete an actual authenticator and all that
            # remainds are backup interfaces, then we kill them in the
            # process.
            if not authenticator.interface.is_backup_interface:
                interfaces = Authenticator.objects.all_interfaces_for_user(user)
                backup_interfaces = [
                    x for x in interfaces
                    if x.is_backup_interface
                ]
                if len(backup_interfaces) == len(interfaces):
                    for iface in backup_interfaces:
                        iface.authenticator.delete()

                    # wait to generate entries until all pending writes
                    # have been sent to db
                    for iface in backup_interfaces:
                        capture_security_activity(
                            account=request.user,
                            type='mfa-removed',
                            actor=request.user,
                            ip_address=request.META['REMOTE_ADDR'],
                            context={
                                'authenticator': iface.authenticator,
                            },
                            send_email=False,
                        )

            capture_security_activity(
                account=user,
                type='mfa-removed',
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                context={
                    'authenticator': authenticator,
                },
                send_email=not authenticator.interface.is_backup_interface,
            )

        return Response(status=204)
