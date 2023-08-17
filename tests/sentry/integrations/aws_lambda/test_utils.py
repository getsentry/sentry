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
    get_option_value,
    get_supported_functions,
    get_version_of_arn,
    parse_arn,
)
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import TestCase


class ParseArnTest(TestCase):
    def test_simple(self):
        arn = (
            "arn:aws:cloudformation:us-east-2:599817902985:stack/"
            "Sentry-Monitoring-Stack/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30"
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
        fn = {
            "Runtime": "nodejs10.x",
            "FunctionArn": "arn:aws:lambda:us-east-2:599817902985:function:lambdaB",
        }
        assert get_latest_layer_version(fn) == 3


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
            "main_docs_url": "https://docs.sentry.io/platforms/node/guides/aws-lambda",
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

    def test_no_cache(self):
        assert get_option_value(self.node_fn, OPTION_VERSION) == "3"
        assert get_option_value(self.node_fn, OPTION_LAYER_NAME) == "my-layer"
        assert get_option_value(self.node_fn, OPTION_ACCOUNT_NUMBER) == "1234"
        assert get_option_value(self.python_fn, OPTION_VERSION) == "34"
        assert get_option_value(self.python_fn, OPTION_LAYER_NAME) == "my-python-layer"
        assert get_option_value(self.python_fn, OPTION_ACCOUNT_NUMBER) == "1234"

    @patch.object(cache, "get")
    def test_with_cache(self, mock_get):
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
    def test_invalid_region(self, mock_get):
        fn = {
            "Runtime": "nodejs10.x",
            "FunctionArn": "arn:aws:lambda:us-gov-east-1:599817902985:function:lambdaB",
        }
        mock_get.return_value = self.cache_value
        with override_settings(SENTRY_RELEASE_REGISTRY_BASEURL="http://localhost:5000"):
            with pytest.raises(IntegrationError, match="Unsupported region us-gov-east-1"):
                get_option_value(fn, OPTION_VERSION)

    @patch.object(cache, "get")
    def test_cache_miss(self, mock_get):
        mock_get.return_value = {}
        with override_settings(SENTRY_RELEASE_REGISTRY_BASEURL="http://localhost:5000"):
            with pytest.raises(
                IntegrationError,
                match="Could not find cache value with key aws-layer:node",
            ):
                get_option_value(self.node_fn, OPTION_VERSION)
