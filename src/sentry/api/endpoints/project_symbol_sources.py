from uuid import uuid4

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.parameters import GlobalParams, ProjectParams
from sentry.lang.native.sources import (
    REDACTED_SOURCE_SCHEMA,
    REDACTED_SOURCES_SCHEMA,
    VALID_CASINGS,
    VALID_LAYOUTS,
    InvalidSourcesError,
    backfill_source,
    parse_sources,
    redact_source_secrets,
    validate_sources,
)
from sentry.models.project import Project
from sentry.utils import json


class LayoutSerializer(serializers.Serializer):
    """
    Layout settings for the source. This is required for HTTP, GCS, and S3 sources and invalid for AppStoreConnect sources.

    **`type`** ***(string)*** - The layout of the folder structure. The options are:
    - `native` - Platform-Specific (SymStore / GDB / LLVM)
    - `symstore` - Microsoft SymStore
    - `symstore_index2` - Microsoft SymStore (with index2.txt)
    - `ssqp` - Microsoft SSQP
    - `unified` - Unified Symbol Server Layout
    - `debuginfod` - debuginfod

    **`casing`** ***(string)*** - The layout of the folder structure. The options are:
    - `default` - Default (mixed case)
    - `uppercase` - Uppercase
    - `lowercase` - Lowercase

    ```json
    {
        "layout": {
            "type": "native"
            "casing": "default"
        }
    }
    ```
    """

    type = serializers.ChoiceField(
        choices=VALID_LAYOUTS, help_text="The source's layout type.", required=True
    )
    casing = serializers.ChoiceField(
        choices=VALID_CASINGS, help_text="The source's casing rules.", required=True
    )


class SourceSerializer(serializers.Serializer):
    type = serializers.ChoiceField(
        choices=[
            ("appStoreConnect", "App Store Connect"),
            ("http", "SymbolServer (HTTP)"),
            ("gcs", "Google Cloud Storage"),
            ("s3", "Amazon S3"),
        ],
        required=True,
        help_text="The type of the source.",
    )
    id = serializers.CharField(
        required=False,
        help_text="The internal ID of the source. Must be distinct from all other source IDs and cannot start with '`sentry:`'. If this is not provided, a new UUID will be generated.",
    )
    name = serializers.CharField(
        required=True,
        help_text="The human-readable name of the source.",
    )
    layout = LayoutSerializer(
        required=False,
    )
    appconnectIssuer = serializers.CharField(
        min_length=36,
        max_length=36,
        required=False,
        help_text="The [App Store Connect Issuer ID](https://developer.apple.com/documentation/appstoreserverapi/generating_tokens_for_api_requests). Required for AppStoreConnect sources, invalid for all others.",
    )
    appconnectKey = (
        serializers.CharField(
            min_length=2,
            max_length=20,
            required=False,
            help_text='The [App Store Connect API Key](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api) ID. Note that the key must have the "Developer" role for Sentry to discover the app builds. Required for AppStoreConnect sources, invalid for all others.',
        ),
    )
    appconnectPrivateKey = serializers.CharField(
        required=False,
        help_text="The [App Store Connect API Private Key](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api). Required for AppStoreConnect sources, invalid for all others.",
    )
    appName = (
        serializers.CharField(
            min_length=1,
            max_length=512,
            required=False,
            help_text="The [App Store Connect App Name](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app). Required for AppStoreConnect sources, invalid for all others.",
        ),
    )
    appId = serializers.CharField(
        min_length=1,
        required=False,
        help_text="The App Store Connect App ID. Required for AppStoreConnect sources, invalid for all others.",
    )
    bundleId = (
        serializers.CharField(
            min_length=1,
            required=False,
            help_text="The [App Store Connect App Bundle](https://developer.apple.com/help/app-store-connect/create-an-app-record/create-and-submit-app-bundles) ID. Required for AppStoreConnect sources, invalid for all others.",
        ),
    )
    url = serializers.CharField(
        required=False,
        help_text="The source's URL. Optional for HTTP sources, invalid for all others.",
    )
    username = serializers.CharField(
        required=False,
        help_text="The user name for accessing the source. Optional for HTTP sources, invalid for all others.",
    )
    password = serializers.CharField(
        required=False,
        help_text="The password for accessing the source. Optional for HTTP sources, invalid for all others.",
    )
    bucket = serializers.CharField(
        required=False,
        help_text="The GCS or S3 bucket where the source resides. Required for GCS and S3 sourcse, invalid for HTTP and AppStoreConnect sources.",
    )
    region = serializers.ChoiceField(
        choices=[
            ("us-east-2", "US East (Ohio)"),
            ("us-east-1", "US East (N. Virginia)"),
            ("us-west-1", "US West (N. California)"),
            ("us-west-2", "US West (Oregon)"),
            ("ap-east-1", "Asia Pacific (Hong Kong)"),
            ("ap-south-1", "Asia Pacific (Mumbai)"),
            ("ap-northeast-2", "Asia Pacific (Seoul)"),
            ("ap-southeast-1", "Asia Pacific (Singapore)"),
            ("ap-southeast-2", "Asia Pacific (Sydney)"),
            ("ap-northeast-1", "Asia Pacific (Tokyo)"),
            ("ca-central-1", "Canada (Central)"),
            ("cn-north-1", "China (Beijing)"),
            ("cn-northwest-1", "China (Ningxia)"),
            ("eu-central-1", "EU (Frankfurt)"),
            ("eu-west-1", "EU (Ireland)"),
            ("eu-west-2", "EU (London)"),
            ("eu-west-3", "EU (Paris)"),
            ("eu-north-1", "EU (Stockholm)"),
            ("sa-east-1", "South America (São Paulo)"),
            ("us-gov-east-1", "AWS GovCloud (US-East)"),
            ("us-gov-west-1", "AWS GovCloud (US)"),
        ],
        required=False,
        help_text="The source's [S3 region](https://docs.aws.amazon.com/general/latest/gr/s3.html). Required for S3 sources, invalid for all others.",
    )
    access_key = serializers.CharField(
        required=False,
        help_text="The [AWS Access Key](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html#access-keys-and-secret-access-keys).Required for S3 sources, invalid for all others.",
    )
    secret_key = serializers.CharField(
        required=False,
        help_text="The [AWS Secret Access Key](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html#access-keys-and-secret-access-keys).Required for S3 sources, invalid for all others.",
    )
    prefix = serializers.CharField(
        required=False,
        help_text="The GCS or [S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-prefixes.html) prefix. Optional for GCS and S3 sourcse, invalid for HTTP and AppStoreConnect sources.",
    )
    client_email = serializers.CharField(
        required=False,
        help_text="The GCS email address for authentication. Required for GCS sources, invalid for all others.",
    )
    private_key = serializers.CharField(
        required=False,
        help_text="The GCS private key. Required for GCS sources, invalid for all others.",
    )

    def validate(self, data):
        if data["type"] == "appStoreConnect":
            required = [
                "type",
                "name",
                "appconnectIssuer",
                "appconnectKey",
                "appconnectPrivateKey",
                "appName",
                "appId",
                "bundleId",
            ]
            allowed = required
        elif data["type"] == "http":
            required = ["type", "name", "url", "layout"]
            allowed = required + ["username", "password"]
        elif data["type"] == "s3":
            required = ["type", "name", "bucket", "region", "access_key", "secret_key", "layout"]
            allowed = required + ["prefix"]
        else:
            required = ["type", "name", "bucket", "client_email", "private_key", "layout"]
            allowed = required + ["prefix"]

        missing = [field for field in required if field not in data]
        invalid = [field for field in data if field not in allowed]

        err = ""
        if missing:
            err += f"Missing fields: {missing}\n"
        if invalid:
            err += f"Invalid fields: {invalid}"

        if err:
            raise serializers.ValidationError(err)

        return data


@extend_schema(tags=["Projects"])
@region_silo_endpoint
class ProjectSymbolSourcesEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_NATIVE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "DELETE": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve a Project's Symbol Sources",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ProjectParams.source_id(
                "The ID of the source to look up. If this is not provided, all sources are returned.",
                False,
            ),
        ],
        responses={
            200: REDACTED_SOURCES_SCHEMA,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.GET_SYMBOL_SOURCES,
    )
    def get(self, request: Request, project: Project) -> Response:
        """
        List custom symbol sources configured for a project.
        """
        id = request.GET.get("id")
        custom_symbol_sources_json = project.get_option("sentry:symbol_sources") or []
        sources = parse_sources(custom_symbol_sources_json, False)
        redacted = redact_source_secrets(sources)

        if id:
            for source in redacted:
                if source["id"] == id:
                    return Response([source])
            return Response(data={"error": f"Unknown source id: {id}"}, status=404)

        return Response(redacted)

    @extend_schema(
        operation_id="Delete a Symbol Source from a Project",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ProjectParams.source_id("The ID of the source to delete.", True),
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.DELETE_SYMBOL_SOURCE,
    )
    def delete(self, request: Request, project: Project) -> Response:
        """
        Delete a custom symbol source from a project.
        """
        id = request.GET.get("id")
        custom_symbol_sources_json = project.get_option("sentry:symbol_sources") or []

        sources = parse_sources(custom_symbol_sources_json, False)

        if id:
            filtered_sources = [src for src in sources if src["id"] != id]
            if len(filtered_sources) == len(sources):
                return Response(data={"error": f"Unknown source id: {id}"}, status=404)

            serialized = json.dumps(filtered_sources)
            project.update_option("sentry:symbol_sources", serialized)
            return Response(status=204)

        return Response(data={"error": "Missing source id"}, status=404)

    @extend_schema(
        operation_id="Add a Symbol Source to a Project",
        parameters=[GlobalParams.ORG_SLUG, GlobalParams.PROJECT_SLUG],
        request=SourceSerializer,
        responses={
            201: REDACTED_SOURCE_SCHEMA,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=ProjectExamples.ADD_SYMBOL_SOURCE,
    )
    def post(self, request: Request, project: Project) -> Response:
        """
        Add a custom symbol source to a project.
        """
        custom_symbol_sources_json = project.get_option("sentry:symbol_sources") or []
        sources = parse_sources(custom_symbol_sources_json, False)

        source = request.data

        if "id" in source:
            id = source["id"]
        else:
            id = str(uuid4())
            source["id"] = id

        sources.append(source)

        try:
            validate_sources(sources)
        except InvalidSourcesError:
            return Response(status=400)

        serialized = json.dumps(sources)
        project.update_option("sentry:symbol_sources", serialized)

        redacted = redact_source_secrets([source])
        return Response(data=redacted[0], status=201)

    @extend_schema(
        operation_id="Update a Project's Symbol Source",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ProjectParams.source_id("The ID of the source to update.", True),
        ],
        request=SourceSerializer,
        responses={
            200: REDACTED_SOURCE_SCHEMA,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.UPDATE_SYMBOL_SOURCE,
    )
    def put(self, request: Request, project: Project) -> Response:
        """
        Update a custom symbol source in a project.
        """
        id = request.GET.get("id")
        source = request.data

        custom_symbol_sources_json = project.get_option("sentry:symbol_sources") or []
        sources = parse_sources(custom_symbol_sources_json, False)

        if id is None:
            return Response(data={"error": "Missing source id"}, status=404)

        if "id" not in source:
            source["id"] = str(uuid4())

        try:
            sources_by_id = {src["id"]: src for src in sources}
            backfill_source(source, sources_by_id)
        except InvalidSourcesError:
            return Response(status=400)
        except KeyError:
            return Response(status=400)

        found = False
        for i in range(len(sources)):
            if sources[i]["id"] == id:
                found = True
                sources[i] = source
                break

        if not found:
            return Response(data={"error": f"Unknown source id: {id}"}, status=404)

        try:
            validate_sources(sources)
        except InvalidSourcesError as e:
            return Response(data={"error": str(e)}, status=400)

        serialized = json.dumps(sources)
        project.update_option("sentry:symbol_sources", serialized)

        redacted = redact_source_secrets([source])
        return Response(data=redacted[0], status=200)
