from sentry.utils.retries import sigmoid_delay


def test_sigmoid_delay():
    results = [sigmoid_delay()(i) for i in range(125)]
    assert results[0] == 0.0066928509242848554
    assert results[5] == 0.5
    assert results[10] == 0.9933071490757153
    assert results[124] == 1
    assert sum(results) == 119.4960857616948  # Max two minute sleep.
