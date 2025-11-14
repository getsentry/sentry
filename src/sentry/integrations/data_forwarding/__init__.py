from typing import int
from sentry.integrations.data_forwarding.amazon_sqs.forwarder import AmazonSQSForwarder
from sentry.integrations.data_forwarding.segment.forwarder import SegmentForwarder
from sentry.integrations.data_forwarding.splunk.forwarder import SplunkForwarder
from sentry.integrations.types import DataForwarderProviderSlug

FORWARDER_REGISTRY = {
    DataForwarderProviderSlug.SEGMENT.value: SegmentForwarder,
    DataForwarderProviderSlug.SQS.value: AmazonSQSForwarder,
    DataForwarderProviderSlug.SPLUNK.value: SplunkForwarder,
}
