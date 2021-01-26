from sentry.integrations.aws_lambda.utils import (
    parse_arn,
    get_supported_functions,
    get_version_of_arn,
    get_latest_layer_for_function,
    get_latest_layer_version,
    get_index_of_sentry_layer,
    get_function_layer_arns,
)
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


class GetVersionOfArnTest(TestCase):
    def test_simple(self):
        assert get_version_of_arn("arn:aws:lambda:us-east-2:1234:layer:my-layer:3") == 3


class GetLatestLayerForFunctionTest(TestCase):
    def test_simple(self):
        fn = {
            "Runtime": "nodejs10.x",
            "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
        }
        assert get_latest_layer_for_function(fn) == "arn:aws:lambda:us-east-2:1234:layer:my-layer:3"


class GetLatestLayerVersionTest(TestCase):
    def test_simple(self):
        assert get_latest_layer_version("nodejs10.x") == 3


class GetIndexOfSentryLayerTest(TestCase):
    def test_layer_found(self):
        layers = [
            "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
            "arn:aws:lambda:us-east-2:1234:layer:my-layer:1",  # match old version
        ]
        assert (
            get_index_of_sentry_layer(layers, "arn:aws:lambda:us-east-2:1234:layer:my-layer:3") == 1
        )

    def test_layer_not_found(self):
        layers = [
            "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
            "arn:aws:lambda:us-east-2:1234:layer:hey-this-is-different:3",
        ]
        assert (
            get_index_of_sentry_layer(layers, "arn:aws:lambda:us-east-2:1234:layer:my-layer:3")
            == -1
        )


class GetFunctionLayerArns(TestCase):
    def test_basic(self):
        function = {
            "Layers": [
                {"Arn": "arn:aws:lambda:us-east-2:1234:layer:something-else:2"},
                "arn:aws:lambda:us-east-2:1234:layer:my-layer:3",
            ]
        }
        assert get_function_layer_arns(function) == [
            "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
            "arn:aws:lambda:us-east-2:1234:layer:my-layer:3",
        ]


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
