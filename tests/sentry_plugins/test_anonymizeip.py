from sentry_plugins.anonymizeip import anonymize_ip


def test_ipv6():
    assert anonymize_ip("5219:3a94:fdc5:19e1:70a3:b2c4:40ef:ae03") == "5219:3a94:fdc5::"


def test_ipv4():
    assert anonymize_ip("192.168.128.193") == "192.168.128.0"
