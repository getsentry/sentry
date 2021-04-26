import requests
from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.utils import fernet_encrypt as encrypt
from sentry.utils.appleconnect import appstore_connect, itunes_connect
from sentry.utils.appleconnect.itunes_connect import ITunesHeaders


def credentials_key_name():
    return "sentry:appleconnect_key"


def credentials_name():
    return "sentry:appleconnect_credentials"


class AppStoreConnectCredentialsSerializer(serializers.Serializer):
    """
    Serializer for the App Store Connect (Rest) credentials
    """

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    issuer = serializers.CharField(
        max_length=36, min_length=36, required=True, source="appconnectIssuer"
    )
    # about 10 chars
    key = serializers.CharField(max_length=20, min_length=2, required=True, source="appconnectKey")
    # 512 should fit a private key
    private_key = serializers.CharField(
        max_length=512, required=True, source="appconnectPrivateKey"
    )


class AppStoreConnectAppsEndpoint(ProjectEndpoint):
    """
    This endpoint returns the applications defined for an account
    It also serves to validate that credentials for App Store connect are valid
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request):
        serializer = AppStoreConnectCredentialsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        session = requests.Session()
        data = serializer.validated_data
        credentials = appstore_connect.AppConnectCredentials(
            key_id=data.get("key"), key=data.get("private_key"), issuer_id=data.get("issuer")
        )
        apps = appstore_connect.get_apps(session, credentials)
        if apps is None:
            return Response("App connect authentication error", status=401)

        apps = [{"name": app.name, "bundleId": app.bundle_id, "appId": app.app_id} for app in apps]
        result = {"apps": apps}

        return Response(result, status=200)


class AppStoreFullCredentialsSerializer(serializers.Serializer):
    """
    Serializer for the full Apple connect credentials AppStoreConnect + ITunes
    """

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    issuer = serializers.CharField(
        max_length=36, min_length=36, required=True, source="appconnectIssuer"
    )
    # about 10 chars
    key = serializers.CharField(max_length=20, min_length=2, required=True, source="appconnectKey")
    # 512 should fit a private key
    private_key = serializers.CharField(
        max_length=512, required=True, source="appconnectPrivateKey"
    )
    itunes_user = serializers.CharField(
        max_length=100, min_length=1, required=True, source="itunesUser"
    )
    itunes_password = serializers.CharField(
        max_length=100, min_length=1, required=True, source="itunesPassword"
    )
    app_name = serializers.CharField(max_length=512, min_length=1, required=True, source="appName")
    app_id = serializers.CharField(max_length=512, min_length=1, required=True, source="appId")
    session_context = serializers.CharField(max_length=2000, source="sessionContext")


class AppStoreConnectCredentialsEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            "organizations:app-store-connect", project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreFullCredentialsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        key = project.get_option(credentials_key_name())

        if key is None:
            # probably stage 1 login was not called
            return Response("Invalid state", status=400)

        credentials = encrypt.encrypt_object(serializer.validated_data)

        encrypted_context = credentials.pop("session_context")

        try:
            validation_context = encrypt.decrypt_object(encrypted_context, key)
            itunes_session = validation_context.get("itunes_session")
            credentials["itunes_session"] = itunes_session
            encrypted_credentials = encrypt.encrypt_object(credentials, key)
            project.update_option(credentials_name(), encrypted_credentials)
        except ValueError:
            return Response("Invalid validation context passed", status=400)
        return Response(status=204)

    def get(self, request, project):
        if not features.has(
            "organizations:app-store-connect", project.organization, actor=request.user
        ):
            return Response(status=404)


class AppStoreConnectCredentialsValidateEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def get_result(self, configured: bool, app_store: bool, itunes: bool):
        return {
            "configured": configured,
            "appstoreCredentialsValid": app_store,
            "itunesSessionValid": itunes,
        }

    def get(self, request, project):
        key = project.get_option(credentials_key_name())
        encrypted_credentials = project.get_option(credentials_name())
        if key is None or encrypted_credentials is None:
            return Response(self.get_result(False, False, False), status=200)

        try:
            cred_dict = encrypt.decrypt_object(encrypted_credentials, key)
        except ValueError:
            return Response(status=500)

        credentials = appstore_connect.AppConnectCredentials(
            key_id=cred_dict.get("key"),
            key=cred_dict.get("private_key"),
            issuer_id=cred_dict.get("issuer"),
        )

        session = requests.Session()
        apps = appstore_connect.get_apps(session, credentials)

        appstore_valid = apps is not None
        itunes_connect.load_session_cookie(session, cred_dict.get("itunes_session"))
        itunes_session_valid = itunes_connect.is_session_valid(session)

        return Response(
            self.get_result(configured=True, app_store=appstore_valid, itunes=itunes_session_valid)
        )


class AppStoreConnectStartAuthSerializer(serializers.Serializer):
    """
    Serializer for the Itunes start connect operation
    """

    itunes_user = serializers.CharField(
        max_length=100, min_length=1, required=False, source="itunesUser"
    )
    itunes_password = serializers.CharField(
        max_length=100, min_length=1, required=False, source="itunesPassword"
    )


class AppStoreConnectStartAuthEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            "organizations:app-store-connect", project.organization, actor=request.user
        ):
            return Response("Access denied", status=404)

        serializer = AppStoreConnectStartAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        user_name = serializer.validated_data.get("itunes_user")
        password = serializer.validated_data.get("itunes_password")

        key = project.get_option(credentials_key_name())

        if key is None:
            # no encryption key for this project, create one
            key = encrypt.create_key()
            project.update_option(credentials_key_name(), key)
        else:
            # we have an encryption key, see if the credentials were not
            # supplied and we just want to re validate the session
            if user_name is None or password is None:
                # credentials not supplied use saved credentials

                encrypted_credentials = project.get_option(credentials_name())
                if key is None or encrypted_credentials is None:
                    return Response(self.get_result(False, False, False), status=200)

                try:
                    cred_dict = encrypt.decrypt_object(encrypted_credentials, key)
                except ValueError:
                    return Response("invalid credentials state", status=500)

                user_name = cred_dict.get("itunes_user")
                password = cred_dict.get("itunes_password")

                if user_name is None or password is None:
                    return Response("invalid credentials", status=500)

        session = requests.session()

        auth_key = itunes_connect.get_auth_service_key(session)

        if auth_key is None:
            return Response("Could not contact itunes store", status=500)

        if user_name is None:
            return Response("no user name provided", status=400)
        if password is None:
            return Response("no password provided", status=400)

        init_login_result = itunes_connect.initiate_login(
            session, service_key=auth_key, account_name=user_name, password=password
        )
        if init_login_result is None:
            return Response("itunes login failed", status=400)

        # send session context to be used in next calls
        session_context = {
            "auth_key": auth_key,
            "session_id": init_login_result.session_id,
            "scnt": init_login_result.scnt,
        }

        return Response(
            {"sessionContext": encrypt.encrypt_object(session_context, key)}, status=200
        )


class AppStoreConnectRequestSmsSerializer(serializers.Serializer):
    session_context = serializers.CharField(
        min_length=1, max_length=2000, source="sessionContext", required=True
    )


class AppStoreConnectRequestSmsEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            "organizations:app-store-connect", project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnectRequestSmsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        session = requests.Session()

        encrypted_context = serializer.validated_data.get("session_context")
        key = project.get_option(credentials_key_name())

        if key is None:
            return Response("out of order call, call start auth first", status=400)

        try:
            # recover the headers set in the first step authentication
            session_context = encrypt.decrypt_object(encrypted_context, key)
            headers = ITunesHeaders(
                session_id=session_context.get("session_id"), scnt=session_context.get("scnt")
            )
            auth_key = session_context.get("auth_key")

        except ValueError:
            return Response("Invalid validation context passed", status=400)

        phone_info = itunes_connect.get_trusted_phone_info(
            session, service_key=auth_key, headers=headers
        )

        if phone_info is None:
            return Response("Could not get phone info", status=400)

        init_phone_login = itunes_connect.initiate_phone_login(
            session,
            service_key=auth_key,
            headers=headers,
            phone_id=phone_info.id,
            push_mode=phone_info.push_mode,
        )

        if init_phone_login is None:
            return Response("Phone 2fa failed", status=500)

        # success, return the new session context (add phone_id and push mode to the session context)
        session_context["phone_id"] = phone_info.id
        session_context["push_mode"] = phone_info.push_mode
        encrypted_context = encrypt.encrypt_object(session_context, key)
        return Response({"sessionContext": encrypted_context}, status=200)


class AppStoreConnect2FactorAuthSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=10, required=True)
    use_sms = serializers.CharField(max_length=10, source="useSms", required=True)
    session_context = serializers.CharField(
        min_length=1, max_length=2000, source="sessionContext", required=True
    )


class AppStoreConnect2FactorAuthEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            "organizations:app-store-connect", project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnectRequestSmsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        encrypted_context = serializer.validated_data.get("session_context")
        key = project.get_option(credentials_key_name())
        use_sms = serializer.validated_data.get("use_sms")
        code = serializer.validated_data.get("code")

        if key is None:
            # probably stage 1 login was not called
            return Response("Invalid state", status=400)

        try:
            # recover the headers set in the first step authentication
            session_context = encrypt.decrypt_object(encrypted_context, key)
            headers = ITunesHeaders(
                session_id=session_context.get("session_id"), scnt=session_context.get("scnt")
            )
            auth_key = session_context.get("auth_key")

            session = requests.Session()

            if use_sms:
                phone_id = session_context.get("phone_id")
                push_mode = session_context.get("push_mode")
                success = itunes_connect.send_phone_authentication_confirmation_code(
                    session,
                    service_key=auth_key,
                    headers=headers,
                    phone_id=phone_id,
                    push_mode=push_mode,
                    security_code=code,
                )
            else:
                success = itunes_connect.send_authentication_confirmation_code(
                    session, service_key=auth_key, headers=headers, security_code=code
                )

            if success:
                itunes_session = itunes_connect.get_session_cookie(session)
                session_context = {
                    "auth_key": auth_key,
                    "session_id": headers.session_id,
                    "scnt": headers.scnt,
                    "itunes_session": itunes_session,
                }
                encrypted_context = encrypt.encrypt_object(session_context, key)
                return Response({"session_context": encrypted_context}, status=200)
            else:
                return Response("2FA failed", status=401)

        except ValueError:
            return Response("Invalid validation context passed", status=400)
