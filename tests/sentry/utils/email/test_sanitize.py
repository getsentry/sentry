from sentry.utils.email.sanitize import WORD_JOINER, sanitize_outbound_name


class TestSanitizeOutboundName:
    def test_plain_name_unchanged(self) -> None:
        assert sanitize_outbound_name("My Company") == "My Company"

    def test_periods_get_word_joiner(self) -> None:
        result = sanitize_outbound_name("evil.com")
        assert result == f"evil{WORD_JOINER}.com"

    def test_multiple_periods(self) -> None:
        result = sanitize_outbound_name("sub.evil.com")
        assert result == f"sub{WORD_JOINER}.evil{WORD_JOINER}.com"

    def test_url_scheme_broken(self) -> None:
        result = sanitize_outbound_name("https://evil.com")
        assert "://" not in result
        assert f":{WORD_JOINER}//" in result

    def test_url_scheme_and_periods(self) -> None:
        result = sanitize_outbound_name("https://evil.com/path")
        assert "://" not in result
        assert f"{WORD_JOINER}." in result

    def test_control_chars_stripped(self) -> None:
        result = sanitize_outbound_name("evil\x00name\x07here")
        assert "\x00" not in result
        assert "\x07" not in result
        assert "evilnamehere" in result

    def test_newlines_preserved(self) -> None:
        """Regular newlines and tabs are NOT stripped (only true control chars)."""
        result = sanitize_outbound_name("line1\nline2\ttab")
        assert "\n" in result
        assert "\t" in result

    def test_empty_string(self) -> None:
        assert sanitize_outbound_name("") == ""

    def test_emoji_preserved(self) -> None:
        result = sanitize_outbound_name("My Org 🚀")
        assert "🚀" in result

    def test_unicode_name_preserved(self) -> None:
        result = sanitize_outbound_name("Ünïcödé Org")
        assert result == "Ünïcödé Org"

    def test_scam_style_payload(self) -> None:
        name = "Free Offer: 2g.tel/promo 👈Click Here."
        result = sanitize_outbound_name(name)
        assert "." not in result.replace(WORD_JOINER + ".", "")
