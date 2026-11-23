from sentry.telemetry_classifiers.prebuilt import ALL_PREBUILT_CLASSIFIERS, PREBUILT_CLASSIFIERS
from sentry.telemetry_classifiers.serializers import RESULT_ATTRIBUTE_PATTERN
from sentry.telemetry_classifiers.types import TelemetryClassifierOutputType


def test_keys_are_unique() -> None:
    keys = [classifier.key for classifier in ALL_PREBUILT_CLASSIFIERS]

    assert len(keys) == len(set(keys))
    assert list(PREBUILT_CLASSIFIERS) == keys


def test_result_attributes_are_unique() -> None:
    result_attributes = [classifier.result_attribute for classifier in ALL_PREBUILT_CLASSIFIERS]

    assert len(result_attributes) == len(set(result_attributes))


def test_result_attributes_are_valid() -> None:
    for classifier in ALL_PREBUILT_CLASSIFIERS:
        assert RESULT_ATTRIBUTE_PATTERN.match(classifier.result_attribute), classifier.key


def test_only_binary_classifiers_have_a_binary_threshold() -> None:
    for classifier in ALL_PREBUILT_CLASSIFIERS:
        if classifier.output_type == TelemetryClassifierOutputType.BINARY:
            assert classifier.binary_threshold is not None, classifier.key
            assert 0 < classifier.binary_threshold < 1, classifier.key
        else:
            assert classifier.binary_threshold is None, classifier.key
