from sentry.objectstore import parse_accept_encoding


def test_parse_accept_encoding_simple():
    assert parse_accept_encoding("gzip") == ["gzip"]


def test_parse_accept_encoding_multiple():
    assert parse_accept_encoding("gzip, zstd, br") == ["gzip", "zstd", "br"]


def test_parse_accept_encoding_strips_q_values():
    assert parse_accept_encoding("gzip;q=0.9, zstd;q=1.0") == ["gzip", "zstd"]


def test_parse_accept_encoding_excludes_q0():
    assert parse_accept_encoding("gzip;q=0, zstd") == ["zstd"]


def test_parse_accept_encoding_empty():
    assert parse_accept_encoding("") == []


def test_parse_accept_encoding_normalizes_case():
    assert parse_accept_encoding("GZIP, Zstd") == ["gzip", "zstd"]
