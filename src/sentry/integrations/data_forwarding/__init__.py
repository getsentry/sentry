from sentry.integrations.types import DataForwarderProviderSlug

from .amazon_sqs.forwarder import AmazonSQSForwarder
from .segment.forwarder import SegmentForwarder
from .splunk.forwarder import SplunkForwarder

FORWARDER_REGISTRY = {
    DataForwarderProviderSlug.SEGMENT.value: SegmentForwarder,
    DataForwarderProviderSlug.SQS.value: AmazonSQSForwarder,
    DataForwarderProviderSlug.SPLUNK.value: SplunkForwarder,
}
