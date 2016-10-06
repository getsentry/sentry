from __future__ import absolute_import

from sentry.utils.avatar import get_letter_avatar


def test_letter_avatar():
    # Test name as display name and email as identifier
    letter_avatar = get_letter_avatar('Jane Doe', 'janedoe@example.com')
    assert 'JD' in letter_avatar
    assert '#f868bc' in letter_avatar  # pink
    assert 'svg' in letter_avatar

    # Test email as display name and id as identifier
    letter_avatar = get_letter_avatar('johnsmith@example.com', 2)
    assert 'J' in letter_avatar
    assert '#57be8c' in letter_avatar  # green

    # Test no display name and ip address as identifier
    letter_avatar = get_letter_avatar(None, '127.0.0.1')
    assert '?' in letter_avatar
    assert '#ec5e44' in letter_avatar  # red

    # Test display name with trailing spaces
    letter_avatar = get_letter_avatar('johnsmith@example.com ', 2)
    assert 'J' in letter_avatar
    assert '#57be8c' in letter_avatar  # green

    # Test name as display name and email as identifier for html
    letter_avatar = get_letter_avatar('Jane Doe', 'janedoe@example.com', use_svg=False)
    assert 'JD' in letter_avatar
    assert '#f868bc' in letter_avatar  # pink
    assert 'span' in letter_avatar

    # Test email as display name and id as identifier for html
    letter_avatar = get_letter_avatar('johnsmith@example.com', 2, use_svg=False)
    assert 'J' in letter_avatar
    assert '#57be8c' in letter_avatar  # green

    # Test no display name and ip address as identifier for html
    letter_avatar = get_letter_avatar(None, '127.0.0.1', use_svg=False)
    assert '?' in letter_avatar
    assert '#ec5e44' in letter_avatar  # red
