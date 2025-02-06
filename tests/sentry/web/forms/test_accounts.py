from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import no_silo_test
from sentry.users.models.user_option import UserOption
from sentry.web.forms.accounts import RegistrationForm


def test_valid_does_not_crash_without_username() -> None:
    form = RegistrationForm({"password": "watwatwatwatwatwatawtataw"})
    assert form.is_valid() is False


@no_silo_test
@django_db_all
def test_sets_user_timezone_when_present() -> None:
    form_data = {
        "username": "a@b.com",
        "name": "Test",
        "password": "watwatwatwatwatwatawtataw",
        "timezone": "Europe/Vienna",
    }

    form = RegistrationForm(data=form_data)
    assert form.is_valid()

    user = form.save(commit=True)

    assert UserOption.objects.filter(
        user=user, key="timezone", value="Europe/Vienna"
    ).exists(), "Timezone should be set correctly"


@no_silo_test
@django_db_all
def test_registration_form_without_timezone():
    form_data = {
        "username": "a@b.com",
        "name": "Test",
        "password": "watwatwatwatwatwatawtataw",
        # No timezone provided
    }

    form = RegistrationForm(data=form_data)
    assert form.is_valid()

    user = form.save(commit=True)

    assert not UserOption.objects.filter(
        user=user, key="timezone"
    ).exists(), "Timezone should not be set"
