from .consecutive_db_detector import ConsecutiveDBSpanDetector  # NOQA
from .consecutive_http_detector import ConsecutiveHTTPSpanDetector  # NOQA
from .file_io_main_thread_detector import FileIOMainThreadDetector  # NOQA
from .mn_plus_one_db_span_detector import MNPlusOneDBSpanDetector  # NOQA
from .n_plus_one_api_calls_detector import NPlusOneAPICallsDetector  # NOQA
from .n_plus_one_db_span_detector import (  # NOQA
    NPlusOneDBSpanDetector,
    NPlusOneDBSpanDetectorExtended,
)
from .render_blocking_asset_span_detector import RenderBlockingAssetSpanDetector  # NOQA
from .slow_db_query_detector import SlowDBQueryDetector  # NOQA
from .uncompressed_asset_detector import UncompressedAssetSpanDetector  # NOQA
