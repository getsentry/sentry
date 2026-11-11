from sentry.telemetry_classifiers.prebuilt import ALL_PREBUILT_CLASSIFIERS, PREBUILT_CLASSIFIERS
from sentry.telemetry_classifiers.serializers import RESULT_ATTRIBUTE_PATTERN


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
