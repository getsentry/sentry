import boto3

from sentry import options
from sentry.utils import json


class ConfigurationError(Exception):
    pass


def gen_aws_client(account_number, region, aws_external_id, service_name="lambda"):
    """
    account_number - acccount number in AWS
    regon - region in AWS
    aws_external_id - the external_id used to assume the role

    Returns an aws_lambda_client
    """

    aws_access_key_id = options.get("aws-lambda.access-key-id")
    aws_secret_access_key = options.get("aws-lambda.secret-access-key")

    # throw a configuration error if we don't have keys
    if not aws_access_key_id or not aws_secret_access_key:
        raise ConfigurationError("AWS access key ID or secret access key not set")

    # start with the credentials of the Sentry user
    starting_client = boto3.client(
        service_name="sts",
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        region_name=options.get("aws-lambda.host-region"),
    )

    # the account where the user exists with the credentials used above
    host_account_number = options.get("aws-lambda.account-number")
    role_in_host = f"arn:aws:iam::{host_account_number}:role/sentry-lambda-role"

    # assume the starting role in our host account
    starting_role = starting_client.assume_role(
        RoleSessionName="Sentry",
        RoleArn=role_in_host,
    )
    assumed_role_creds = starting_role["Credentials"]

    # now use the credentials from the role we assumed to create another STS client
    client = boto3.client(
        service_name="sts",
        aws_access_key_id=assumed_role_creds["AccessKeyId"],
        aws_secret_access_key=assumed_role_creds["SecretAccessKey"],
        aws_session_token=assumed_role_creds["SessionToken"],
        region_name=options.get("aws-lambda.host-region"),
    )

    role_in_user_account = f"arn:aws:iam::{account_number}:role/SentryRole"

    # assume the role in the client account
    assumed_role_object = client.assume_role(
        RoleSessionName="Sentry",
        RoleArn=role_in_user_account,
        ExternalId=aws_external_id,
        # need policy statements for cross account access
        Policy=json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": ["lambda:UpdateFunctionConfiguration", "lambda:GetFunction"],
                        "Resource": "arn:aws:lambda:{}:{}:function:*".format(
                            region, account_number
                        ),
                    },
                    {
                        "Effect": "Allow",
                        "Action": [
                            "lambda:ListFunctions",
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
