from typing import int
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache
from django.test import override_settings

from sentry.integrations.aws_lambda.utils import (
    OPTION_ACCOUNT_NUMBER,
    OPTION_LAYER_NAME,
    OPTION_VERSION,
    get_function_layer_arns,
    get_index_of_sentry_layer,
    get_latest_layer_for_function,
    get_latest_layer_version,
    get_node_options_for_layer,
    get_option_value,
    get_supported_functions,
    get_version_of_arn,
    parse_arn,
)
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import TestCase


class ParseArnTest(TestCase):
    def test_simple(self) -> None:
        arn = (
            "arn:aws:cloudformation:us-east-2:599817902985:stack/"
            "Sentry-Monitoring-Stack/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30"
        )
        parsed = parse_arn(arn)
        assert parsed["account"] == "599817902985"
        assert parsed["region"] == "us-east-2"


class GetVersionOfArnTest(TestCase):
    def test_simple(self) -> None:
        assert get_version_of_arn("arn:aws:lambda:us-east-2:1234:layer:my-layer:3") == 3


class GetLatestLayerForFunctionTest(TestCase):
    def test_simple(self) -> None:
        fn = {
            "Runtime": "nodejs10.x",
            "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
        }
        assert get_latest_layer_for_function(fn) == "arn:aws:lambda:us-east-2:1234:layer:my-layer:3"


class GetLatestLayerVersionTest(TestCase):
    def test_simple(self) -> None:
        fn = {
            "Runtime": "nodejs10.x",
            "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
        }
        assert get_latest_layer_version(fn) == 3


class GetIndexOfSentryLayerTest(TestCase):
    def test_layer_found(self) -> None:
        layers = [
            "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
            "arn:aws:lambda:us-east-2:1234:layer:my-layer:1",  # match old version
        ]
        assert (
            get_index_of_sentry_layer(layers, "arn:aws:lambda:us-east-2:1234:layer:my-layer:3") == 1
        )

    def test_layer_not_found(self) -> None:
        layers = [
            "arn:aws:lambda:us-east-2:1234:layer:something-else:2",
            "arn:aws:lambda:us-east-2:1234:layer:hey-this-is-different:3",
        ]
        assert (
            get_index_of_sentry_layer(layers, "arn:aws:lambda:us-east-2:1234:layer:my-layer:3")
            == -1
        )


class GetFunctionLayerArns(TestCase):
    def test_basic(self) -> None:
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
    mock_client = MagicMock()
    mock_client.get_paginator.return_value.paginate.return_value = [
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
                {"FunctionName": "lambdaE", "Runtime": "nodejs14.x"},
            ]
        },
    ]

    assert get_supported_functions(mock_client) == [
        {"FunctionName": "lambdaA", "Runtime": "nodejs12.x"},
        {"FunctionName": "lambdaB", "Runtime": "nodejs10.x"},
        {"FunctionName": "lambdaC", "Runtime": "nodejs12.x"},
        {"FunctionName": "lambdaD", "Runtime": "python3.6"},
        {"FunctionName": "lambdaE", "Runtime": "nodejs14.x"},
    ]

    mock_client.get_paginator.assert_called_once_with("list_functions")


class GetOptionValueTest(TestCase):
    node_fn = {
        "Runtime": "nodejs10.x",
        "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
    }
    python_fn = {
        "Runtime": "python3.6",
        "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaC",
    }

    cache_value = {
        "aws-layer:node": {
            "name": "AWS Lambda Node Layer",
            "canonical": "aws-layer:node",
            "sdk_version": "5.29.3",
            "account_number": "943013980633",
            "layer_name": "SentryNodeServerlessSDK",
            "repo_url": "https://github.com/getsentry/sentry-javascript",
            "main_docs_url": "https://docs.sentry.io/platforms/javascript/guides/aws-lambda",
            "regions": [
                {"region": "us-east-2", "version": "19"},
                {"region": "us-west-1", "version": "17"},
            ],
        },
        "aws-layer:python": {
            "name": "AWS Lambda Python Layer",
            "canonical": "aws-layer:python",
            "sdk_version": "0.20.3",
            "account_number": "943013980633",
            "layer_name": "SentryPythonServerlessSDK",
            "repo_url": "https://github.com/getsentry/sentry-python",
            "main_docs_url": "https://docs.sentry.io/platforms/python/guides/aws-lambda/",
            "regions": [
                {"region": "eu-west-1", "version": "2"},
                {"region": "us-east-2", "version": "2"},
            ],
        },
    }

    def test_no_cache(self) -> None:
        assert get_option_value(self.node_fn, OPTION_VERSION) == "3"
        assert get_option_value(self.node_fn, OPTION_LAYER_NAME) == "my-layer"
        assert get_option_value(self.node_fn, OPTION_ACCOUNT_NUMBER) == "1234"
        assert get_option_value(self.python_fn, OPTION_VERSION) == "34"
        assert get_option_value(self.python_fn, OPTION_LAYER_NAME) == "my-python-layer"
        assert get_option_value(self.python_fn, OPTION_ACCOUNT_NUMBER) == "1234"

    @patch.object(cache, "get")
    def test_with_cache(self, mock_get: MagicMock) -> None:
        mock_get.return_value = self.cache_value
        with override_settings(SENTRY_RELEASE_REGISTRY_BASEURL="http://localhost:5000"):
            assert get_option_value(self.node_fn, OPTION_VERSION) == "19"
            assert get_option_value(self.node_fn, OPTION_LAYER_NAME) == "SentryNodeServerlessSDK"
            assert get_option_value(self.node_fn, OPTION_ACCOUNT_NUMBER) == "943013980633"
            assert get_option_value(self.python_fn, OPTION_VERSION) == "2"
            assert (
                get_option_value(self.python_fn, OPTION_LAYER_NAME) == "SentryPythonServerlessSDK"
            )
            assert get_option_value(self.python_fn, OPTION_ACCOUNT_NUMBER) == "943013980633"

    @patch.object(cache, "get")
    def test_invalid_region(self, mock_get: MagicMock) -> None:
        fn = {
            "Runtime": "nodejs10.x",
            "FunctionArn": "arn:aws:lambda:us-gov-east-1:599817902985:function:lambdaB",
        }
        mock_get.return_value = self.cache_value
        with override_settings(SENTRY_RELEASE_REGISTRY_BASEURL="http://localhost:5000"):
            with pytest.raises(IntegrationError, match="Unsupported region us-gov-east-1"):
                get_option_value(fn, OPTION_VERSION)

    @patch.object(cache, "get")
    def test_cache_miss(self, mock_get: MagicMock) -> None:
        mock_get.return_value = {}
        with override_settings(SENTRY_RELEASE_REGISTRY_BASEURL="http://localhost:5000"):
            with pytest.raises(
                IntegrationError,
                match="Could not find cache value with key aws-layer:node",
            ):
                get_option_value(self.node_fn, OPTION_VERSION)


class GetNodeOptionsForLayerTest(TestCase):
    """Test the get_node_options_for_layer function for different layer scenarios."""

    def test_v7_layer_name(self) -> None:
        """Test SentryNodeServerlessSDKv7 returns v7 SDK options."""
        result = get_node_options_for_layer("SentryNodeServerlessSDKv7", None)
        assert result == "-r @sentry/serverless/dist/awslambda-auto"

    def test_sentry_node_serverless_sdk_version_236_boundary(self) -> None:
        """Test SentryNodeServerlessSDK at version boundary 236 returns v8 SDK options."""
        result = get_node_options_for_layer("SentryNodeServerlessSDK", 236)
        assert result == "-r @sentry/aws-serverless/awslambda-auto"

    def test_v8_layer_name(self) -> None:
        """Test SentryNodeServerlessSDKv8 returns v8 SDK options with -r."""
        result = get_node_options_for_layer("SentryNodeServerlessSDKv8", None)
        assert result == "-r @sentry/aws-serverless/awslambda-auto"

    def test_v10_layer_name(self) -> None:
        """Test SentryNodeServerlessSDKv10 at version boundary 13 returns v8 SDK options with -r."""
        result = get_node_options_for_layer("SentryNodeServerlessSDKv10", 13)
        assert result == "-r @sentry/aws-serverless/awslambda-auto"

    def test_v10_layer_version_14_boundary(self) -> None:
        """Test SentryNodeServerlessSDKv10 at version boundary 14 returns v10+ SDK options with --import."""
        result = get_node_options_for_layer("SentryNodeServerlessSDKv10", 14)
        assert result == "--import @sentry/aws-serverless/awslambda-auto"

    def test_v11_layer_name(self) -> None:
        """Test SentryNodeServerlessSDKv11 returns v10+ SDK options with --import."""
        result = get_node_options_for_layer("SentryNodeServerlessSDKv11", None)
        assert result == "--import @sentry/aws-serverless/awslambda-auto"
