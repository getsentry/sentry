from __future__ import absolute_import

import six
import copy
import logging

from sentry.similarity.features import FeatureSet
from sentry.similarity.encoder import Encoder

logger = logging.getLogger(__name__)

#: The grouping strategy to use for driving similarity. You can add multiple
#: strategies here to index them all. This is useful for transitioning a
#: similarity dataset to newer grouping configurations.
#: Check out `test_similarity_config_migration` to understand the procedure and risks.
_CONFIGURATIONS_TO_INDEX = frozenset(["newstyle:2019-10-29"])

#: We need this list of known labels generated from all grouping components to
#: be able to compare events with different contributing components.
_KNOWN_COMPONENT_LABEL_SUFFIXES = frozenset(
    [
        "message:character-5-shingle",
        "symbol:ident-shingle",
        "context-line:ident-shingle",
        "frame:frame-ident",
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
        self.expected_extraction_errors = ()
        self.expected_encoding_errors = ()

    @property
    def features(self):
        return {
            "{}:{}".format(cfg, suffix): None
            for cfg in _CONFIGURATIONS_TO_INDEX
            for suffix in _KNOWN_COMPONENT_LABEL_SUFFIXES
        }

    @property
    def aliases(self):
        return {k: k for k in self.features}

    def extract(self, event):
        results = {}

        # backup data to work around mutations in get_grouping_variants
        data_bak = copy.deepcopy(event._data)

        for configuration in _CONFIGURATIONS_TO_INDEX:
            variants = event.get_grouping_variants(
                force_config=configuration, normalize_stacktraces=True,
            )
            event._data = data_bak

            for variant in variants.values():
                for label_suffix, feature in variant.encode_for_similarity():
                    label = "{}:{}".format(configuration, label_suffix)

                    results.setdefault(label, set()).update(feature)

        return {label: sorted(features) for label, features in six.iteritems(results)}
