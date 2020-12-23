from __future__ import absolute_import

from sentry.integrations.aws_lambda.utils import parse_arn, get_supported_functions
from sentry.testutils import TestCase
from sentry.testutils.helpers.faux import Mock
from sentry.utils.compat.mock import MagicMock


class ParseArnTest(TestCase):
    def test_simple(self):
        arn = (
            "arn:aws:cloudformation:us-east-2:599817902985:stack/"
            "Sentry-Monitoring-Stack-Filter/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30"
        )
        parsed = parse_arn(arn)
        assert parsed["account"] == "599817902985"
        assert parsed["region"] == "us-east-2"


class GetSupportedFunctionsTest(TestCase):
    mock_client = Mock()
    mock_paginate = MagicMock()
    mock_paginate.paginate = MagicMock(
        return_value=[
            {
                "Functions": [
                    {"FunctionName": "lambdaA", "Runtime": "nodejs12.x"},
                    {"FunctionName": "lambdaB", "Runtime": "nodejs10.x"},
                ]
            },
            {
                "Functions": [
                    {"FunctionName": "lambdaC", "Runtime": "nodejs12.x"},
                    {"FunctionName": "lambdaD", "Runtime": "python3.6"},
                ]
            },
        ]
    )

    mock_client.get_paginator = MagicMock(return_value=mock_paginate)

    assert get_supported_functions(mock_client) == [
        {"FunctionName": "lambdaA", "Runtime": "nodejs12.x"},
        {"FunctionName": "lambdaB", "Runtime": "nodejs10.x"},
        {"FunctionName": "lambdaC", "Runtime": "nodejs12.x"},
    ]

    mock_client.get_paginator.assert_called_once_with("list_functions")
