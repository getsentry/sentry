from sentry.utils.display_name_filter import check_spam_display_name


class TestCheckSpamDisplayName:
    def test_clean_name_passes(self) -> None:
        assert check_spam_display_name("My Company Inc.") is None

    def test_single_currency_signal_passes(self) -> None:
        assert check_spam_display_name("BTC Analytics") is None

    def test_single_cta_verb_passes(self) -> None:
        assert check_spam_display_name("Click Studios") is None

    def test_single_cta_urgency_passes(self) -> None:
        assert check_spam_display_name("Do It Now Labs") is None

    def test_cta_verb_plus_urgency_alone_passes(self) -> None:
        assert check_spam_display_name("Click Here Studios") is None

    def test_single_shorturl_signal_passes(self) -> None:
        assert check_spam_display_name("bit.ly/promo team") is None

    def test_currency_plus_cta_rejected(self) -> None:
        assert check_spam_display_name("Free BTC - Click Here") is not None

    def test_currency_plus_shorturl_rejected(self) -> None:
        assert check_spam_display_name("Earn $100 via 2g.tel/promo") is not None

    def test_shorturl_without_slash_not_matched(self) -> None:
        assert check_spam_display_name("support.com Solutions") is None

    def test_cta_plus_shorturl_rejected(self) -> None:
        assert check_spam_display_name("Click Here: bit.ly/free") is not None

    def test_bare_shorturl_domain_without_path_passes(self) -> None:
        assert check_spam_display_name("Free BTC bit.ly") is None

    def test_all_three_categories_rejected(self) -> None:
        result = check_spam_display_name("Win $50 ETH bit.ly/offer Claim Now")
        assert result is not None

    def test_case_insensitive(self) -> None:
        result = check_spam_display_name("FREE BTC - CLICK HERE")
        assert result is not None

    def test_currency_emoji_detected(self) -> None:
        result = check_spam_display_name(
            "\U0001f4b2Compensation Btc: 2g.tel/x Click Your Pay Link."
        )
        assert result is not None

    def test_single_currency_emoji_passes(self) -> None:
        assert check_spam_display_name("My \U0001f4b0 Company") is None

    def test_cta_novel_combo_rejected(self) -> None:
        result = check_spam_display_name("Withdraw Now - Free BTC")
        assert result is not None

    def test_substring_sol_in_solutions_not_matched(self) -> None:
        assert check_spam_display_name("Impactful Solutions") is None

    def test_substring_eth_in_method_not_matched(self) -> None:
        assert check_spam_display_name("Method Analytics") is None

    def test_substring_act_in_contact_not_matched(self) -> None:
        assert check_spam_display_name("Contact Knowledge Solutions") is None

    def test_substring_now_in_knowledge_not_matched(self) -> None:
        assert check_spam_display_name("Knowledge Now Platform") is None

    def test_substring_here_in_where_not_matched(self) -> None:
        assert check_spam_display_name("Where We Shine") is None

    def test_empty_string_passes(self) -> None:
        assert check_spam_display_name("") is None

    def test_error_message_format(self) -> None:
        result = check_spam_display_name("Free BTC - Click Here")
        assert result is not None
        assert "disallowed content" in result
        assert "Please choose a different name" in result
