from __future__ import absolute_import

import six
import copy
import logging

from django.conf import settings

from sentry.similarity.features import FeatureSet
from sentry.similarity.encoder import Encoder

logger = logging.getLogger(__name__)


# We need this list of known labels generated from all grouping components to
# be able to compare events with different contributing components.
#
# This is currently just mushing all component names from all strategy
# configurations together, but in theory we could split this up into a mapping
# of (config_name) -> (set of labels). Even better would be to be able to
# statically determine this for any given strategy configuration without this
# list (requires refactor of grouping)
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
    def __init__(self, index, configurations=None):
        self.index = index

        if configurations is None:
            configurations = settings.SENTRY_SIMILARITY_GROUPING_CONFIGURATIONS_TO_INDEX

        self.configurations = configurations

        # This is intentionally non-configurable and only exists because we
        # subclass from FeatureSet. TODO: Remove FeatureSet subclassing!
        # eg: Replace with ABC hierarchy or kill old similarity.
        self.encoder = Encoder()
        self.expected_extraction_errors = ()
        self.expected_encoding_errors = ()

        self.features = {
            "{}:{}".format(cfg, suffix): None
            for cfg in self.configurations
            for suffix in _KNOWN_COMPONENT_LABEL_SUFFIXES
        }

        self.aliases = {k: k for k in self.features}

    def extract(self, event):
        results = {}

        # backup data to work around mutations in get_grouping_variants
        data_bak = copy.deepcopy(event._data)

        for configuration in self.configurations:
            variants = event.get_grouping_variants(
                force_config=configuration, normalize_stacktraces=True,
            )
            event._data = data_bak

            for variant in variants.values():
                for label_suffix, feature in variant.encode_for_similarity():
                    label = "{}:{}".format(configuration, label_suffix)
                    assert label in self.features

                    results.setdefault(label, set()).update(feature)

        return {label: sorted(features) for label, features in six.iteritems(results)}
