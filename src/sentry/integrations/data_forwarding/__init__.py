from collections.abc import Mapping

from sentry.integrations.data_forwarding.amazon_sqs.forwarder import AmazonSQSForwarder
from sentry.integrations.data_forwarding.base import BaseDataForwarder
from sentry.integrations.data_forwarding.segment.forwarder import SegmentForwarder
from sentry.integrations.data_forwarding.splunk.forwarder import SplunkForwarder
from sentry.integrations.types import DataForwarderProviderSlug

FORWARDER_REGISTRY: Mapping[str, type[BaseDataForwarder]] = {
    DataForwarderProviderSlug.SEGMENT.value: SegmentForwarder,
    DataForwarderProviderSlug.SQS.value: AmazonSQSForwarder,
    DataForwarderProviderSlug.SPLUNK.value: SplunkForwarder,
}
