# The fake TLD used to construct email addresses when one is required,
# for example by automatically generated SSO accounts.
FAKE_EMAIL_TLD = ".sentry-fake"


def create_fake_email(unique_id, namespace):
    """
    Generate a fake email of the form: {unique_id}@{namespace}{FAKE_EMAIL_TLD}

    For example: c74e5b75-e037-4e75-ad27-1a0d21a6b203@cloudfoundry.sentry-fake
    """
    return f"{unique_id}@{namespace}{FAKE_EMAIL_TLD}"


def is_fake_email(email):
    """Returns True if the provided email matches the fake email pattern."""
    return email.endswith(FAKE_EMAIL_TLD)
