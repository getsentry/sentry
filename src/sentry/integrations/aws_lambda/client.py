from __future__ import annotations

import logging
from typing import Any

import boto3
from django.http import HttpResponse, JsonResponse
from rest_framework import serializers

from sentry import options
from sentry.services.hybrid_cloud.util import control_silo_function, region_silo_function
from sentry.shared_integrations.client.proxy import IntegrationProxyClient, get_proxy_url
from sentry.silo.base import SiloMode
from sentry.utils import json


class ConfigurationError(Exception):
    pass


logger = logging.getLogger(__name__)


class ExceptionSerializer(serializers.Serializer):
    vars()["class"] = serializers.CharField(required=True)


class ProxyResponseSerializer(serializers.Serializer):
    function_name = serializers.CharField(required=True)
    return_response = serializers.DictField(required=True)
    exception = ExceptionSerializer(required=True, allow_null=True)


def gen_aws_client(account_number, region, aws_external_id, service_name="lambda"):
    """
    account_number - account ID in AWS
    region - region in AWS
    aws_external_id - the external_id used to assume the role

    Returns an aws_lambda_client
    """

    role_arn = f"arn:aws:iam::{account_number}:role/SentryRole"

    aws_access_key_id = options.get("aws-lambda.access-key-id")
    aws_secret_access_key = options.get("aws-lambda.secret-access-key")

    # throw a configuration error if we don't have keys
    if not aws_access_key_id or not aws_secret_access_key:
        raise ConfigurationError("AWS access key ID or secret access key not set")

    client = boto3.client(
        service_name="sts",
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        region_name=options.get("aws-lambda.host-region"),
    )

    # need policy statements for cross account access
    assumed_role_object = client.assume_role(
        RoleSessionName="Sentry",
        RoleArn=role_arn,
        ExternalId=aws_external_id,
        Policy=json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": ["lambda:UpdateFunctionConfiguration", "lambda:GetFunction"],
                        "Resource": f"arn:aws:lambda:{region}:{account_number}:function:*",
                    },
                    {
                        "Effect": "Allow",
                        "Action": [
                            "lambda:ListFunctions",
                            "lambda:ListLayerVersions",
                            "lambda:GetLayerVersion",
                            "organizations:DescribeAccount",
                        ],
                        "Resource": "*",
                    },
                ],
            }
        ),
    )

    credentials = assumed_role_object["Credentials"]

    boto3_session = boto3.Session(
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
    )
    return boto3_session.client(service_name=service_name, region_name=region)


class AwsLambdaProxyClient(IntegrationProxyClient):
    integration_name = "aws_lambda"
    _client: Any | None = None

    def __init__(
        self,
        org_integration_id: int | None,
        account_number: str,
        region: str,
        aws_external_id: str,
    ) -> None:
        self.base_url = get_proxy_url()
        self.account_number = account_number
        self.region = region
        self.aws_external_id = aws_external_id
        super().__init__(org_integration_id=org_integration_id)

    @property
    def client(self):
        if self._client:
            return self._client

        self._client = gen_aws_client(
            account_number=self.account_number,
            region=self.region,
            aws_external_id=self.aws_external_id,
        )
        return self._client

    def should_delegate(self) -> bool:
        return True

    def delegate(self, request, proxy_path: str, headers) -> HttpResponse:
        payload = request.data
        function_name = payload["function_name"]
        args = payload["args"]
        kwargs = payload["kwargs"]
        boto3_func = getattr(self.client, function_name)
        try:
            result = boto3_func(*args, **kwargs)
            return JsonResponse(
                data={
                    "function_name": function_name,
                    "return_response": result,
                    "exception": None,
                },
                status=200,
            )
        except Exception as err:
            logger.info("boto3.client.exception", extra={"error": err})
            return JsonResponse(
                data={
                    "function_name": function_name,
                    "return_response": {},
                    "exception": {"class": err.__class__.__name__},
                },
                status=400,
            )

    def __getattr__(self, func_name: str):
        if SiloMode.get_current_mode() != SiloMode.REGION:

            @control_silo_function
            def boto3_func(*args, **kwargs):
                func = getattr(self.client, func_name)
                return func(*args, **kwargs)

            return boto3_func

        @region_silo_function
        def boto3_proxy_func(*args, **kwargs):
            # From the region silo, we create a request payload to the internal integration proxy endpoint.
            payload = {
                "args": list(args),
                "kwargs": kwargs,
                "function_name": func_name,
            }

            response = self.post("/", data=payload)
            proxy_response = ProxyResponseSerializer(data=response)
            if not proxy_response.is_valid():
                raise Exception(f"Invalid response from calling: {func_name}")
            validated_data = proxy_response.validated_data

            function_name = validated_data["function_name"]
            assert function_name == func_name

            exception = validated_data["exception"]
            if exception:
                class_name = exception["class"]
                lambda_client = self.client
                exception_cls = getattr(lambda_client.exceptions, class_name)
                raise exception_cls()

            return_response = validated_data["return_response"]
            return return_response

        return boto3_proxy_func
