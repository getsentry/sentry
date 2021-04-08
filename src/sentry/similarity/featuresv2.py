import copy
import logging

from django.conf import settings

from sentry.similarity.encoder import Encoder
from sentry.similarity.features import FeatureSet

logger = logging.getLogger(__name__)


# We need this list of known labels generated from all grouping components to
# be able to compare events with different contributing components.
#
# This is currently just mushing all component names from all strategy
# configurations together, but in theory we could split this up into a mapping
# of (config_name) -> (set of labels). Even better would be to be able to
# statically determine this for any given strategy configuration without this
# list (requires refactor of grouping)
#
# (<component ID>, <shingle label>) -> <redis prefix>
_KNOWN_COMPONENT_LABEL_SUFFIXES = {
    ("message", "character-5-shingle"): "a",
    ("symbol", "ident-shingle"): "b",
    ("context-line", "ident-shingle"): "c",
    ("frame", "frame-ident"): "d",
    ("filename", "ident-shingle"): "e",
    ("module", "ident-shingle"): "f",
    ("function", "ident-shingle"): "g",
    ("lineno", "ident-shingle"): "h",
    ("stacktrace", "frames-pairs"): "i",
    ("type", "ident-shingle"): "j",
    ("value", "character-5-shingle"): "k",
    ("fingerprint", "ident-shingle"): "l",
    ("stacktrace", "frames-ident"): "m",
}

assert len(set(_KNOWN_COMPONENT_LABEL_SUFFIXES.values())) == len(_KNOWN_COMPONENT_LABEL_SUFFIXES)


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
            (config_id, component_id, shingle_label): None
            for config_id in self.configurations
            for component_id, shingle_label in _KNOWN_COMPONENT_LABEL_SUFFIXES
        }

        self.aliases = {
            (config_id, component_id, shingle_label): "{}:{}".format(
                self.configurations[config_id],
                _KNOWN_COMPONENT_LABEL_SUFFIXES[component_id, shingle_label],
            )
            for config_id, component_id, shingle_label in self.features
        }

    def extract(self, event):
        results = {}

        # backup data to work around mutations in get_grouping_variants
        data_bak = copy.deepcopy(event._data)

        for configuration in self.configurations:
            variants = event.get_grouping_variants(
                force_config=configuration,
                normalize_stacktraces=True,
            )
            event._data = data_bak

            for variant in variants.values():
                for (component_id, shingle_label), features in variant.encode_for_similarity():
                    label = (configuration, component_id, shingle_label)
                    assert label in self.features

                    results.setdefault(label, set()).update(features)

        return {label: sorted(features) for label, features in results.items()}
