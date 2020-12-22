from __future__ import absolute_import

from sentry.integrations.aws_lambda.utils import parse_arn

from sentry.testutils import TestCase


class ParseArnTest(TestCase):
    def test_simple(self):
        arn = (
            "arn:aws:cloudformation:us-east-2:599817902985:stack/"
            "Sentry-Monitoring-Stack-Filter/e42083d0-3e3f-11eb-b66a-0ac9b5db7f30"
        )
        parsed = parse_arn(arn)
        assert parsed["account"] == "599817902985"
        assert parsed["region"] == "us-east-2"
