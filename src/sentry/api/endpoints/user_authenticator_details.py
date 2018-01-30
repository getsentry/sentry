from __future__ import absolute_import

from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint, UserPermission
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import Authenticator
from sentry.security import capture_security_activity


class UserAuthenticatorDetailsEndpoint(UserEndpoint):
    permission_classes = (IsAuthenticated, UserPermission, )

    # @sudo_required
    def get(self, request, user, auth_id):
        """
        Get Authenticator Interface
        ```````````````````````````

        Retrieves authenticator interface details for user depending on user enrollment status

        :pparam string user_id: user id or "me" for current user
        :pparam string auth_id: authenticator model id

        :auth: required
        """

        try:
            authenticator = Authenticator.objects.get(user=user, id=int(auth_id))
        except ValueError:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        except Authenticator.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        interface = authenticator.interface

        # User is enrolled to auth interface:
        # - display interface details
        # - show enrolled specific details like:
        #    - created at, last used dates
        #    - phone number for SMS
        #    - recovery codes
        response = serialize(interface)

        if interface.interface_id == 'recovery':
            response['codes'] = interface.get_unused_codes()
        if interface.interface_id == 'sms':
            response['phone'] = interface.phone_number
        if interface.interface_id == 'u2f':
            response['devices'] = interface.get_registered_devices()

        return Response(response)

    @sudo_required
    def put(self, request, user, auth_id):
        """
        Modify authenticator interface
        ``````````````````````````````

        Currently, only supports regenerating recovery codes

        :pparam string user_id: user id or 'me' for current user
        :pparam int auth_id: authenticator model id

        :auth required:
        """

        try:
            authenticator = Authenticator.objects.get(
                user=user,
                id=auth_id,
            )
        except ValueError:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        except Authenticator.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        interface = authenticator.interface

        if interface.interface_id == 'recovery':
            interface.regenerate_codes()

        return Response(serialize(interface))

    @sudo_required
    def delete(self, request, user, auth_id):
        """
        Remove authenticator
        ````````````````````

        :pparam string user_id: user id or 'me' for current user
        :pparam string auth_id: authenticator model id

        :auth required:
        """

        try:
            authenticator = Authenticator.objects.get(
                user=user,
                id=auth_id,
            )
        except Authenticator.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            authenticator.delete()

            # if we delete an actual authenticator and all that
            # remainds are backup interfaces, then we kill them in the
            # process.
            if not authenticator.interface.is_backup_interface:
                interfaces = Authenticator.objects.all_interfaces_for_user(user)
                backup_interfaces = [x for x in interfaces if x.is_backup_interface]
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

        return Response(status=status.HTTP_204_NO_CONTENT)
