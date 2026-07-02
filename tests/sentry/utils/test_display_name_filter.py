from sentry.utils.display_name_filter import is_spam_display_name


class TestIsSpamDisplayName:
    def test_clean_name_passes(self) -> None:
        assert not is_spam_display_name("My Company Inc.")

    def test_single_currency_signal_passes(self) -> None:
        assert not is_spam_display_name("BTC Analytics")

    def test_single_cta_verb_passes(self) -> None:
        assert not is_spam_display_name("Click Studios")

    def test_single_cta_urgency_passes(self) -> None:
        assert not is_spam_display_name("Do It Now Labs")

    def test_cta_verb_plus_urgency_alone_passes(self) -> None:
        assert not is_spam_display_name("Click Here Studios")

    def test_single_shorturl_signal_passes(self) -> None:
        assert not is_spam_display_name("bit.ly/promo team")

    def test_currency_plus_cta_rejected(self) -> None:
        assert is_spam_display_name("Free BTC - Click Here")

    def test_currency_plus_shorturl_rejected(self) -> None:
        assert is_spam_display_name("Earn $100 via 2g.tel/promo")

    def test_shorturl_without_slash_not_matched(self) -> None:
        assert not is_spam_display_name("support.com Solutions")

    def test_cta_plus_shorturl_rejected(self) -> None:
        assert is_spam_display_name("Click Here: bit.ly/free")

    def test_bare_shorturl_domain_without_path_passes(self) -> None:
        assert not is_spam_display_name("Free BTC bit.ly")

    def test_all_three_categories_rejected(self) -> None:
        assert is_spam_display_name("Win $50 ETH bit.ly/offer Claim Now")

    def test_case_insensitive(self) -> None:
        assert is_spam_display_name("FREE BTC - CLICK HERE")

    def test_currency_emoji_detected(self) -> None:
        assert is_spam_display_name("\U0001f4b2Compensation Btc: 2g.tel/x Click Your Pay Link.")

    def test_single_currency_emoji_passes(self) -> None:
        assert not is_spam_display_name("My \U0001f4b0 Company")

    def test_cta_novel_combo_rejected(self) -> None:
        assert is_spam_display_name("Withdraw Now - Free BTC")

    def test_substring_sol_in_solutions_not_matched(self) -> None:
        assert not is_spam_display_name("Impactful Solutions")

    def test_substring_eth_in_method_not_matched(self) -> None:
        assert not is_spam_display_name("Method Analytics")

    def test_substring_act_in_contact_not_matched(self) -> None:
        assert not is_spam_display_name("Contact Knowledge Solutions")

    def test_substring_now_in_knowledge_not_matched(self) -> None:
        assert not is_spam_display_name("Knowledge Now Platform")

    def test_substring_here_in_where_not_matched(self) -> None:
        assert not is_spam_display_name("Where We Shine")

    def test_empty_string_passes(self) -> None:
        assert not is_spam_display_name("")
