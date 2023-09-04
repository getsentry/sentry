from sentry.snuba.minimetrics.core import DogStatsDEncoder, ExtractedMetric


def test_encode():
    extracted_metric: ExtractedMetric = {
        "type": "d",
        "name": "lcp",
        "value": [1.0, 0.5, 1.2],
        "timestamp": 10,
        "width": int(10),
        "unit": None,
        "tags": {},
    }

    encoder = DogStatsDEncoder(
        metric_name=extracted_metric["name"],
        metric_value=extracted_metric["value"],
        metric_type=extracted_metric["type"],
        sample_rate=1.0,
        tags={},
    )
    assert encoder.encode() == "lcp:1.0:0.5:1.2|d|@1.0"
