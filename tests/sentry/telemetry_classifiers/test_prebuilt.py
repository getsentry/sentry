from sentry.telemetry_classifiers.prebuilt import ALL_PREBUILT_CLASSIFIERS, PREBUILT_CLASSIFIERS


def test_keys_are_unique() -> None:
    keys = [classifier.key for classifier in ALL_PREBUILT_CLASSIFIERS]

    assert len(keys) == len(set(keys))
    assert list(PREBUILT_CLASSIFIERS) == keys
