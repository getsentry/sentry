from __future__ import absolute_import

import logging

from sentry.similarity.features import FeatureSet
from sentry.similarity.encoder import Encoder

logger = logging.getLogger(__name__)

#: We need this list of known labels generated from all grouping components to
#: be able to compare events that have been processed with different grouping
#: configs/strategies or have different variants.
_KNOWN_COMPONENT_LABELS = frozenset(
    [
        "message:character-5-shingle",
        "symbol:ident-shingle",
        "context-line:ident-shingle",
        "filename:ident-shingle",
        "module:ident-shingle",
        "function:ident-shingle",
        "lineno:ident-shingle",
        "stacktrace:frames-pairs",
        "type:ident-shingle",
        "value:character-5-shingle",
    ]
)


class GroupingBasedFeatureSet(FeatureSet):
    def __init__(self, index):
        self.index = index

        # This is intentionally non-configurable and only exists because we
        # subclass from FeatureSet. TODO: Remove FeatureSet subclassing!
        # eg: Replace with ABC hierarchy or kill old similarity.
        self.encoder = Encoder()
        self.expected_extraction_errors = []
        self.expected_encoding_errors = []

        self.features = {k: None for k in _KNOWN_COMPONENT_LABELS}
        self.aliases = {k: k for k in _KNOWN_COMPONENT_LABELS}

    def extract(self, event):
        variants = event.get_grouping_variants(
            force_config=None,  # TODO: Hardcode specific config or calculate all variants of all configs
            normalize_stacktraces=False,  # TODO: Set to True once we figured out how to not make this mutate
        )

        results = {}
        for variant in variants.values():
            for label, feature in variant.encode_for_similarity():
                if label not in self.features:
                    logger.warn("similarity.unknown-label", extra={"label": label})
                    continue

                results.setdefault(label, []).extend(feature)

        return results
