from __future__ import absolute_import

import boto3

from sentry import options

from .utils import parse_arn


def gen_aws_lambda_client(arn, aws_external_id, session_name="MySession"):
    """
        arn - the arn of the cloudformation stack
        aws_external_id - the external_id used to assume the role

        Returns an aws_lambda_client
    """
    parsed_arn = parse_arn(arn)
    account_id = parsed_arn["account"]
    region = parsed_arn["region"]

    role_arn = "arn:aws:iam::%s:role/SentryRole" % (account_id)

    client = boto3.client(
        service_name="sts",
        aws_access_key_id=options.get("aws-lambda.access-key-id"),
        aws_secret_access_key=options.get("aws-lambda.secret-access-key"),
        region_name=options.get("aws-lambda.region"),
    )

    assumed_role_object = client.assume_role(
        RoleSessionName="MySession", RoleArn=role_arn, ExternalId=aws_external_id
    )

    credentials = assumed_role_object["Credentials"]

    tmp_access_key = credentials["AccessKeyId"]
    tmp_secret_key = credentials["SecretAccessKey"]
    security_token = credentials["SessionToken"]

    boto3_session = boto3.Session(
        aws_access_key_id=tmp_access_key,
        aws_secret_access_key=tmp_secret_key,
        aws_session_token=security_token,
    )
    return boto3_session.client(service_name="lambda", region_name=region)
