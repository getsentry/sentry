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
