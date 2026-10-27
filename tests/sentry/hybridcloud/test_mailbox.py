from sentry.hybridcloud.mailbox import MailboxName


def test_a_bare_mailbox_is_the_provider_and_its_subject() -> None:
    assert str(MailboxName("jira", "123")) == "jira:123"


def test_the_cell_rides_between_the_provider_and_the_subject() -> None:
    """First segment stays the provider and last the event type, so both can be read
    back off a name."""
    mailbox = MailboxName("github", "123", cell="us", event_type="check_run", bucket=45)

    assert str(mailbox) == "github:us:123:45:check_run"


def test_a_mailbox_with_no_cell_keeps_the_rest_of_the_name() -> None:
    assert str(MailboxName("github", "123", bucket=45)) == "github:123:45"


def test_bucket_zero_is_a_bucket() -> None:
    """`0` is the first bucket of a split, not the absence of one."""
    assert str(MailboxName("github", "123", bucket=0)) == "github:123:0"


def test_in_cell_and_in_bucket_leave_the_original_alone() -> None:
    mailbox = MailboxName("github", "123")

    assert str(mailbox.in_cell("us").in_bucket(45)) == "github:us:123:45"
    assert str(mailbox) == "github:123"
