from __future__ import annotations

from click.testing import CliRunner
from exam import fixture

from .base import TestCase


class CliTestCase(TestCase):
    runner = fixture(CliRunner)
    command = None

    default_args = []

    def invoke(self, *args, **kwargs):
        args += tuple(self.default_args)
        return self.runner.invoke(self.command, args, obj={}, **kwargs)
