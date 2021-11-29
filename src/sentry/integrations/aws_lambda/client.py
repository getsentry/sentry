import boto3

from sentry import options
from sentry.utils import json


class ConfigurationError(Exception):
    pass


def gen_aws_client(account_number, region, aws_external_id, service_name="lambda"):
    """
    account_number - account number in AWS
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
