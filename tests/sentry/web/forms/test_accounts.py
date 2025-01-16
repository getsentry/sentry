from sentry.web.forms.accounts import RegistrationForm


def test_valid_does_not_crash_without_username() -> None:
    form = RegistrationForm({"password": "watwatwatwatwatwatawtataw"})
    assert form.is_valid() is False
