from sentry_plugins.amazon_sqs.plugin import AmazonSQSPlugin


def test_conf_key() -> None:
    assert AmazonSQSPlugin().conf_key == "amazon-sqs"
