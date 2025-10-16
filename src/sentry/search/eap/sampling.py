from sentry_protos.snuba.v1.downsampled_storage_pb2 import (
    DownsampledStorageConfig,
    DownsampledStorageMeta,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.constants import SAMPLING_MODE_MAP
from sentry.search.events.types import SAMPLING_MODES


def handle_downsample_meta(meta: DownsampledStorageMeta) -> bool:
    return not meta.can_go_to_higher_accuracy_tier


def validate_sampling(sampling_mode: SAMPLING_MODES | None) -> DownsampledStorageConfig:
    if sampling_mode is None:
        return DownsampledStorageConfig(mode=DownsampledStorageConfig.MODE_NORMAL)
    if sampling_mode not in SAMPLING_MODE_MAP:
        raise InvalidSearchQuery(f"sampling mode: {sampling_mode} is not supported")
    else:
        return DownsampledStorageConfig(mode=SAMPLING_MODE_MAP[sampling_mode])
