from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.user import OrganizationUserPermission, UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import Authenticator
from sentry.security import capture_security_activity


class UserAuthenticatorDetailsEndpoint(UserEndpoint):
    permission_classes = (OrganizationUserPermission,)

    @sudo_required
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
            authenticator = Authenticator.objects.get(user=user, id=auth_id)
        except (ValueError, Authenticator.DoesNotExist):
            return Response(status=status.HTTP_404_NOT_FOUND)

        interface = authenticator.interface

        # User is enrolled to auth interface:
        # - display interface details
        # - show enrolled specific details like:
        #    - created at, last used dates
        #    - phone number for SMS
        #    - recovery codes
        response = serialize(interface)

        if interface.interface_id == "recovery":
            response["codes"] = interface.get_unused_codes()
        if interface.interface_id == "sms":
            response["phone"] = interface.phone_number
        if interface.interface_id == "u2f":
            response["devices"] = interface.get_registered_devices()

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
            authenticator = Authenticator.objects.get(user=user, id=auth_id)
        except (ValueError, Authenticator.DoesNotExist):
            return Response(status=status.HTTP_404_NOT_FOUND)

        interface = authenticator.interface

        if interface.interface_id == "recovery":
            interface.regenerate_codes()

            capture_security_activity(
                account=user,
                type="recovery-codes-regenerated",
                actor=request.user,
                ip_address=request.META["REMOTE_ADDR"],
                context={"authenticator": authenticator},
                send_email=True,
            )
        return Response(serialize(interface))

    @sudo_required
    def delete(self, request, user, auth_id, interface_device_id=None):
        """
        Remove authenticator
        ````````````````````

        :pparam string user_id: user id or 'me' for current user
        :pparam string auth_id: authenticator model id
        :pparam string interface_device_id: some interfaces (u2f) allow multiple devices

        :auth required:
        """

        try:
            authenticator = Authenticator.objects.get(user=user, id=auth_id)
        except (ValueError, Authenticator.DoesNotExist):
            return Response(status=status.HTTP_404_NOT_FOUND)

        interface = authenticator.interface

        # Remove a single device and not entire authentication method
        if interface.interface_id == "u2f" and interface_device_id is not None:
            device_name = interface.get_device_name(interface_device_id)
            # Can't remove if this is the last device, will return False if so
            if not interface.remove_u2f_device(interface_device_id):
                return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            interface.authenticator.save()

            capture_security_activity(
                account=user,
                type="mfa-removed",
                actor=request.user,
                ip_address=request.META["REMOTE_ADDR"],
                context={"authenticator": authenticator, "device_name": device_name},
                send_email=True,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        # if the user's organization requires 2fa,
        # don't delete the last auth method
        enrolled_methods = Authenticator.objects.all_interfaces_for_user(user, ignore_backup=True)
        last_2fa_method = len(enrolled_methods) == 1
        require_2fa = user.get_orgs_require_2fa().exists()

        if require_2fa and last_2fa_method:
            return Response(
                {"detail": "Cannot delete authenticator because organization requires 2FA"},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            authenticator.delete()

            # if we delete an actual authenticator and all that
            # remains are backup interfaces, then we kill them in the
            # process.
            if not interface.is_backup_interface:
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
                            type="mfa-removed",
                            actor=request.user,
                            ip_address=request.META["REMOTE_ADDR"],
                            context={"authenticator": iface.authenticator},
                            send_email=False,
                        )

            capture_security_activity(
                account=user,
                type="mfa-removed",
                actor=request.user,
                ip_address=request.META["REMOTE_ADDR"],
                context={"authenticator": authenticator},
                send_email=not interface.is_backup_interface,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
