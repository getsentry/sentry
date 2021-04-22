import requests
from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint, StrictProjectPermission
from sentry.utils.appleconnect.appstore_connect import AppConnectCredentials, get_apps
from sentry.utils.encryption import encrypt


def credentials_key_name():
    return "sentry:appleconnect_key"


def credentials_name():
    return "sentry:appleconnect_credentials"


class AppStoreConnectCredentialsSerializer(serializers.Serilaizer):
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


class ProjectAppStoreConnectAppsEndpoint(ProjectEndpoint):
    """
    This endpoint returns the applications defined for an account
    It also serves to validate that credentials for App Store connect are valid
    """

    permission_classes = [StrictProjectPermission]

    def post(self, request):
        serializer = AppStoreConnectCredentialsSerializer(data=request.data)

        if serializer.is_valid():
            session = requests.Session()
            data = serializer.validated_data
            credentials = AppConnectCredentials(
                key_id=data.get("key"), key=data.get("private_key"), issuer=data.get("issuer")
            )
            apps = get_apps(session, credentials)
            if apps is None:
                return Response("App connect authentication error", status=401)

            apps = [
                {"name": app.name, "bundleId": app.bundle_id, "appId": app.app_id} for app in apps
            ]
            result = {"apps": apps}

            return Response(result, status=200)

        return Response(serializer.errors, status=400)


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


class ProjectAppStoreConnectCredentialsEndpoint(ProjectEndpoint):
    permission_classes = [StrictProjectPermission]

    def post(self, request, project):
        if not features.has(
            "organizations:app-store-connect", project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = AppStoreFullCredentialsSerializer(data=request.data)
        if serializer.is_valid():
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
        else:
            return Response(serializer.errors, status=400)
        pass
