from uuid import uuid4

import requests
from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.utils import fernet_encrypt as encrypt
from sentry.utils import json
from sentry.utils.appleconnect import appstore_connect, itunes_connect
from sentry.utils.appleconnect.itunes_connect import ITunesHeaders
from sentry.utils.safe import get_path


def credentials_key_name():
    return "sentry:appleconnect_key"


def symbol_sources_prop_name():
    return "sentry:symbol_sources"


def app_store_connect_feature_name():
    return "organizations:app-store-connect"


def get_app_store_credentials(project, credentials_id):
    sources_config = project.get_option(symbol_sources_prop_name())

    if credentials_id is None:
        return None
    try:
        sources = json.loads(sources_config)
        for source in sources:
            if (
                source.get("type") == "appStoreConnect"
                and source.get("id") == credentials_id.lower()
            ):
                return source
        return None
    except BaseException as e:
        raise ValueError("bad sources") from e


class AppStoreConnectCredentialsSerializer(serializers.Serializer):
    """
    Serializer for the App Store Connect (Rest) credentials
    """

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=True)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=True)
    # 512 should fit a private key
    appconnectPrivateKey = serializers.CharField(max_length=512, required=True)


class AppStoreConnectAppsEndpoint(ProjectEndpoint):
    """
    This endpoint returns the applications defined for an account
    It also serves to validate that credentials for App Store connect are valid
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            app_store_connect_feature_name(), project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnectCredentialsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        credentials = appstore_connect.AppConnectCredentials(
            key_id=data.get("appconnectKey"),
            key=data.get("appconnectPrivateKey"),
            issuer_id=data.get("appconnectIssuer"),
        )
        session = requests.Session()

        apps = appstore_connect.get_apps(session, credentials)

        if apps is None:
            return Response("App connect authentication error.", status=401)

        apps = [{"name": app.name, "bundleId": app.bundle_id, "appId": app.app_id} for app in apps]
        result = {"apps": apps}

        return Response(result, status=200)


class AppStoreCreateCredentialsSerializer(serializers.Serializer):
    """
    Serializer for the full Apple connect credentials AppStoreConnect + ITunes
    """

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=True)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=True)
    # 512 should fit a private key
    appconnectPrivateKey = serializers.CharField(max_length=512, required=True)
    itunesUser = serializers.CharField(max_length=100, min_length=1, required=True)
    itunesPassword = serializers.CharField(max_length=512, min_length=1, required=True)
    appName = serializers.CharField(max_length=512, min_length=1, required=True)
    appId = serializers.CharField(max_length=512, min_length=1, required=True)
    sessionContext = serializers.CharField(min_length=1, required=True)
    # this is the ITunes organization the user is a member of ( known as providers in Itunes terminology)
    orgId = serializers.IntegerField(required=True)
    orgName = serializers.CharField(max_length=100, required=True)


class AppStoreConnectCreateCredentialsEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            app_store_connect_feature_name(), project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreCreateCredentialsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        key = project.get_option(credentials_key_name())

        if key is None:
            # probably stage 1 login was not called
            return Response(
                "Invalid state. Must first call appstoreconnect/start/ endpoint.", status=400
            )

        credentials = serializer.validated_data

        encrypted_context = credentials.pop("sessionContext")

        try:
            validation_context = encrypt.decrypt_object(encrypted_context, key)
            itunes_session = validation_context.get("itunes_session")
            encrypted = {
                "itunesSession": itunes_session,
                "itunesPassword": credentials.pop("itunesPassword"),
                "appconnectPrivateKey": credentials.pop("appconnectPrivateKey"),
            }
            credentials["encrypted"] = encrypt.encrypt_object(encrypted, key)
            credentials["type"] = "appStoreConnect"
            credentials["id"] = uuid4().hex
            credentials["name"] = "Apple App Store Connect"

        except ValueError:
            return Response("Invalid validation context passed.", status=400)
        return Response(credentials, status=200)


class AppStoreUpdateCredentialsSerializer(serializers.Serializer):
    """
    Serializer for the full Apple connect credentials AppStoreConnect + ITunes
    """

    # an IID with the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX format
    appconnectIssuer = serializers.CharField(max_length=36, min_length=36, required=False)
    # about 10 chars
    appconnectKey = serializers.CharField(max_length=20, min_length=2, required=False)
    # 512 should fit a private key
    appconnectPrivateKey = serializers.CharField(max_length=512, required=False)
    itunesUser = serializers.CharField(max_length=100, min_length=1, required=False)
    itunesPassword = serializers.CharField(max_length=512, min_length=1, required=False)
    appName = serializers.CharField(max_length=512, min_length=1, required=False)
    appId = serializers.CharField(max_length=512, min_length=1, required=False)
    sessionContext = serializers.CharField(min_length=1, required=False)
    # this is the ITunes organization the user is a member of ( known as providers in Itunes terminology)
    orgId = serializers.IntegerField(required=False)
    orgName = serializers.CharField(max_length=100, required=False)


class AppStoreConnectUpdateCredentialsEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def post(self, request, project, credentials_id):
        if not features.has(
            app_store_connect_feature_name(), project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreUpdateCredentialsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # get the existing credentials
        credentials = get_app_store_credentials(project, credentials_id)
        key = project.get_option(credentials_key_name())

        if key is None or credentials is None:
            return Response(status=404)

        try:
            secrets = encrypt.decrypt_object(credentials.pop("encrypted"), key)
        except ValueError:
            return Response(status=500)

        # get the new credentials
        new_credentials = serializer.validated_data
        encrypted_context = new_credentials.get("sessionContext")

        new_itunes_session = None
        if encrypted_context is not None:
            try:
                validation_context = encrypt.decrypt_object(encrypted_context, key)
                new_itunes_session = validation_context.get("itunes_session")
            except ValueError:
                return Response("Invalid validation context passed.", status=400)

        new_secrets = {}

        if new_itunes_session is not None:
            new_secrets["itunesSession"] = new_itunes_session

        new_itunes_password = new_credentials.get("itunesPassword")
        if new_itunes_password is not None:
            new_secrets["itunesPassword"] = new_itunes_password

        new_appconnect_private_key = new_credentials.get("appconnectPrivateKey")
        if new_appconnect_private_key is not None:
            new_secrets["appconnectPrivateKey"] = new_appconnect_private_key

        # merge the new and existing credentials

        try:
            secrets.update(new_secrets)
            credentials.update(new_credentials)

            credentials["encrypted"] = encrypt.encrypt_object(secrets, key)
            credentials["id"] = uuid4().hex

        except ValueError:
            return Response("Invalid validation context passed.", status=400)
        return Response(credentials, status=200)


class AppStoreConnectCredentialsValidateEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def get_result(self, app_store: bool, itunes: bool):
        return {
            "appstoreCredentialsValid": app_store,
            "itunesSessionValid": itunes,
        }

    def get(self, request, project, credentials_id):
        if not features.has(
            app_store_connect_feature_name(), project.organization, actor=request.user
        ):
            return Response(status=404)

        credentials = get_app_store_credentials(project, credentials_id)
        key = project.get_option(credentials_key_name())

        if key is None or credentials is None:
            return Response(status=404)

        try:
            secrets = encrypt.decrypt_object(credentials.get("encrypted"), key)
        except ValueError:
            return Response(status=500)

        credentials = appstore_connect.AppConnectCredentials(
            key_id=credentials.get("appconnectKey"),
            key=secrets.get("appconnectPrivateKey"),
            issuer_id=credentials.get("appconnectIssuer"),
        )

        session = requests.Session()
        apps = appstore_connect.get_apps(session, credentials)

        appstore_valid = apps is not None
        itunes_connect.load_session_cookie(session, secrets.get("itunesSession"))
        itunes_session_info = itunes_connect.get_session_info(session)

        itunes_session_valid = itunes_session_info is not None

        return Response(
            {
                "appstoreCredentialsValid": appstore_valid,
                "itunesSessionValid": itunes_session_valid,
            },
            status=200,
        )


class AppStoreConnectStartAuthSerializer(serializers.Serializer):
    """
    Serializer for the Itunes start connect operation
    """

    itunesUser = serializers.CharField(max_length=100, min_length=1, required=False)
    itunesPassword = serializers.CharField(max_length=512, min_length=1, required=False)
    id = serializers.CharField(max_length=40, min_length=1, required=False)


class AppStoreConnectStartAuthEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            app_store_connect_feature_name(), project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnectStartAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        user_name = serializer.validated_data.get("itunesUser")
        password = serializer.validated_data.get("itunesPassword")
        credentials_id = serializer.validated_data.get("id")

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

                credentials = get_app_store_credentials(project, credentials_id)
                if key is None or credentials is None:
                    return Response("No credentials provided.", status=400)

                try:
                    secrets = encrypt.decrypt_object(credentials.get("encrypted"), key)
                except ValueError:
                    return Response("Invalid credentials state.", status=500)

                user_name = credentials.get("itunesUser")
                password = secrets.get("itunesPassword")

                if user_name is None or password is None:
                    return Response("Invalid credentials.", status=500)

        session = requests.session()

        auth_key = itunes_connect.get_auth_service_key(session)

        if auth_key is None:
            return Response("Could not contact itunes store.", status=500)

        if user_name is None:
            return Response("No user name provided.", status=400)
        if password is None:
            return Response("No password provided.", status=400)

        init_login_result = itunes_connect.initiate_login(
            session, service_key=auth_key, account_name=user_name, password=password
        )
        if init_login_result is None:
            return Response("ITunes login failed.", status=401)

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
    sessionContext = serializers.CharField(min_length=1, required=True)


class AppStoreConnectRequestSmsEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            app_store_connect_feature_name(), project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnectRequestSmsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        session = requests.Session()

        encrypted_context = serializer.validated_data.get("sessionContext")
        key = project.get_option(credentials_key_name())

        if key is None:
            return Response(
                "Invalid state. Must first call appstoreconnect/start/ endpoint.", status=400
            )

        try:
            # recover the headers set in the first step authentication
            session_context = encrypt.decrypt_object(encrypted_context, key)
            headers = ITunesHeaders(
                session_id=session_context.get("session_id"), scnt=session_context.get("scnt")
            )
            auth_key = session_context.get("auth_key")

        except ValueError:
            return Response("Invalid validation context passed.", status=400)

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
    useSms = serializers.BooleanField(required=True)
    sessionContext = serializers.CharField(min_length=1, required=True)


class AppStoreConnect2FactorAuthEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            app_store_connect_feature_name(), project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreConnect2FactorAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        encrypted_context = serializer.validated_data.get("sessionContext")
        key = project.get_option(credentials_key_name())
        use_sms = serializer.validated_data.get("useSms")
        code = serializer.validated_data.get("code")

        if key is None:
            # probably stage 1 login was not called
            return Response(
                "Invalid state. Must first call appstoreconnect/start/ endpoint.", status=400
            )

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
                session_info = itunes_connect.get_session_info(session)

                if session_info is None:
                    return Response("session info failed", status=500)

                existing_providers = get_path(session_info, "availableProviders")
                providers = [
                    {"name": provider.get("name"), "organizationId": provider.get("providerId")}
                    for provider in existing_providers
                ]
                prs_id = get_path(session_info, "user", "prsId")

                itunes_session = itunes_connect.get_session_cookie(session)
                session_context = {
                    "auth_key": auth_key,
                    "session_id": headers.session_id,
                    "scnt": headers.scnt,
                    "itunes_session": itunes_session,
                    "itunes_person_id": prs_id,
                }
                encrypted_context = encrypt.encrypt_object(session_context, key)

                response_body = {"sessionContext": encrypted_context, "organizations": providers}

                return Response(response_body, status=200)
            else:
                return Response("2FA failed.", status=401)

        except ValueError:
            return Response("Invalid validation context passed.", status=400)
