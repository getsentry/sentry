from unittest import TestCase

import pytest
import responses

from sentry.utils.github import verify_signature

GITHUB_META_PUBLIC_KEYS_RESPONSE = {
    "public_keys": [
        {
            "key_identifier": "90a421169f0a406205f1563a953312f0be898d3c7b6c06b681aa86a874555f4a",
            "key": "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9MJJHnMfn2+H4xL4YaPDA4RpJqUq\nkCmRCBnYERxZanmcpzQSXs1X/AljlKkbJ8qpVIW4clayyef9gWhFbNHWAA==\n-----END PUBLIC KEY-----\n",
            "is_current": False,
        },
        {
            "key_identifier": "bcb53661c06b4728e59d897fb6165d5c9cda0fd9cdf9d09ead458168deb7518c",
            "key": "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEYAGMWO8XgCamYKMJS6jc/qgvSlAd\nAjPuDPRcXU22YxgBrz+zoN19MzuRyW87qEt9/AmtoNP5GrobzUvQSyJFVw==\n-----END PUBLIC KEY-----\n",
            "is_current": True,
        },
    ]
}


class TestGitHub(TestCase):
    def setUp(self):
        # https://docs.github.com/en/code-security/secret-scanning/secret-scanning-partner-program#implement-signature-verification-in-your-secret-alert-service
        self.payload = """[{"source":"commit","token":"some_token","type":"some_type","url":"https://example.com/base-repo-url/"}]"""
        self.signature = "MEQCIQDaMKqrGnE27S0kgMrEK0eYBmyG0LeZismAEz/BgZyt7AIfXt9fErtRS4XaeSt/AO1RtBY66YcAdjxji410VQV4xg=="
        self.key_id = "bcb53661c06b4728e59d897fb6165d5c9cda0fd9cdf9d09ead458168deb7518c"
        self.subpath = "secret_scanning"

    @responses.activate
    def _verify(self):
        responses.add(
            responses.GET,
            "https://api.github.com/meta/public_keys/secret_scanning",
            json=GITHUB_META_PUBLIC_KEYS_RESPONSE,
            status=200,
        )

        verify_signature(self.payload, self.signature, self.key_id, self.subpath)

    def test_verify_signature_success(self):
        self._verify()

    def test_verify_signature_missing_key(self):
        self.key_id = ""
        with pytest.raises(ValueError) as excinfo:
            self._verify()
        assert "Invalid payload, signature, or key_id" in str(excinfo.value)

    def test_verify_signature_invalid_key(self):
        self.key_id = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
        with pytest.raises(ValueError) as excinfo:
            self._verify()
        assert "No public key found matching key identifier" in str(excinfo.value)

    def test_verify_signature_invalid_signature(self):
        self.payload = "[]"
        with pytest.raises(ValueError) as excinfo:
            self._verify()
        assert "Signature does not match payload" in str(excinfo.value)

    def test_verify_signature_invalid_encoding(self):
        self.signature = "fakesignature"
        with pytest.raises(ValueError) as excinfo:
            self._verify()
        assert "Invalid signature encoding" in str(excinfo.value)
