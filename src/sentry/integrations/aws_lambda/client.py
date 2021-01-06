from __future__ import absolute_import

import boto3

from sentry import options
from sentry.utils import json

from .utils import parse_arn


def gen_aws_client(arn, aws_external_id, service_name="lambda"):
    """
    arn - the arn of the cloudformation stack
    aws_external_id - the external_id used to assume the role

    Returns an aws_lambda_client
    """
    parsed_arn = parse_arn(arn)
    account_id = parsed_arn["account"]
    region = parsed_arn["region"]

    role_arn = u"arn:aws:iam::%s:role/SentryRole" % (account_id)

    client = boto3.client(
        service_name="sts",
        aws_access_key_id=options.get("aws-lambda.access-key-id"),
        aws_secret_access_key=options.get("aws-lambda.secret-access-key"),
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
                        "Resource": u"arn:aws:lambda:{}:{}:function:*".format(region, account_id),
                    },
                    {
                        "Effect": "Allow",
                        "Action": [
                            "lambda:ListFunctions",
                            "lambda:GetLayerVersion",
                            "iam:PassRole",
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
