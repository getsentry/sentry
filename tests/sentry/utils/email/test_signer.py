from django.test import override_settings

from sentry.utils.email.signer import _CaseInsensitiveSigner


@override_settings(SECRET_KEY="a")
def test_case_insensitive_signer() -> None:
    # the default salt is the module path
    # the class was moved at some point so this sets a constant salt
    signer = _CaseInsensitiveSigner(salt="sentry.utils.email._CaseInsensitiveSigner")
    assert signer.unsign(signer.sign("foo")) == "foo"
    assert signer.sign("foo") == "foo:wkpxg5djz3d4m0zktktfl9hdzw4"
    assert signer.unsign("foo:WKPXG5DJZ3D4M0ZKTKTFL9HDZW4") == "foo"
