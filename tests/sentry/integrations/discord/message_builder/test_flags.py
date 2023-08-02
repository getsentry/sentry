from __future__ import annotations

from sentry.integrations.discord.message_builder.base.flags import DiscordMessageFlags
from sentry.testutils.cases import TestCase


class TestDiscordMessageFlags(TestCase):
    def assert_bits_are_set(self, value: int, bits: list[int]) -> None:
        expected = 0
        for bit in bits:
            expected = expected | 1 << bit
            assert (value & 1 << bit) == 1 << bit
        assert expected == value

    def test_none(self):
        flags = DiscordMessageFlags()
        assert flags.value == 0

    def test_ephemeral(self):
        flags = DiscordMessageFlags().set_ephemeral()
        self.assert_bits_are_set(flags.value, [6])

    def test_loading(self):
        flags = DiscordMessageFlags().set_loading()
        self.assert_bits_are_set(flags.value, [7])

    def test_suppress_notifications(self):
        flags = DiscordMessageFlags().set_suppress_notifications()
        self.assert_bits_are_set(flags.value, [12])

    def test_all(self):
        flags = DiscordMessageFlags()
        flags.set_ephemeral()
        flags.set_loading()
        flags.set_suppress_notifications()
        self.assert_bits_are_set(flags.value, [6, 7, 12])
