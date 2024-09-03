from sentry.ownership.section_line import SectionLine


def test_get_owners_only_path_owners_returns_path_owners():
    line = SectionLine("", "", ["a", "b"], [])
    assert line.get_owners() == ["a", "b"]


def test_get_owners_only_section_owners_returns_section_owners():
    line = SectionLine("", "", [], ["a", "b"])
    assert line.get_owners() == ["a", "b"]


def test_get_owners_both_owners_returns_path_owners():
    line = SectionLine("", "", ["a", "b"], ["c", "d"])
    assert line.get_owners() == ["a", "b"]


def test_is_preserved_comment_empty_line_returns_true():
    line = SectionLine("", "", [], [])
    assert line.is_preserved_comment is True


def test_is_preserved_valid_comment_returns_true():
    line = SectionLine("# some comment", "", [], [])
    assert line.is_preserved_comment is True


def test_should_skip_valid_comment_returns_false():
    line = SectionLine("# some comment", "", [], [])
    assert line.should_skip() is False


def test_should_skip_line_with_spaces_returns_true():
    line = SectionLine(" ", " ", [], [])
    assert line.should_skip() is True


def test_should_skip_line_valid_path_returns_false():
    line = SectionLine("/fileA.txt", "/fileA.txt", [], [])
    assert line.should_skip() is False


def test_should_skip_line_invalid_path_returns_true():
    line = SectionLine(" cde", " cde", [], [])
    assert line.should_skip() is True


def test_get_dict_key_invalid_path_returns_original_line():
    line = SectionLine("[Section] owner", "[Section]", [], [])
    assert line.get_dict_key() == "[Section] owner"


def test_get_dict_key_returns_path_only():
    line = SectionLine("/fileA.txt githubuser@sentry.io", "/fileA.txt", [], [])
    assert line.get_dict_key() == "/fileA.txt"
