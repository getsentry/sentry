from abc import ABC, abstractmethod
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Generic, TypeVar


@dataclass(frozen=True, eq=True)
class CommandInput:
    cmd_value: str
    arg_values: tuple[str, ...] = ()

    def trim_command_args(self, cmd_obj: "MessagingIntegrationCommand") -> "CommandInput":
        """Remove the arg constants that identify which command to execute."""
        trimmed_args = self.arg_values[len(cmd_obj.arg_tokens) :]
        return CommandInput(self.cmd_value, trimmed_args)


class CommandNotMatchedError(Exception):
    def __init__(self, message: str, unmatched_input: CommandInput) -> None:
        super().__init__(message)
        self.unmatched_input = unmatched_input


@dataclass(frozen=True, eq=True)
class MessagingIntegrationCommand:
    name: str
    cmd_token: str
    arg_tokens: tuple[str, ...] = ()
    aliases: tuple[str, ...] = ()

    def does_match(self, cmd_input: CommandInput) -> bool:
        command_matches = (cmd_input.cmd_value == self.cmd_token) or (
            cmd_input.cmd_value in self.aliases
        )
        arg_prefix = tuple(cmd_input.arg_values)[: len(self.arg_tokens)]
        arg_prefix_matches = arg_prefix == self.arg_tokens
        return command_matches and arg_prefix_matches


MESSAGING_INTEGRATION_COMMANDS = (
    HELP := MessagingIntegrationCommand("HELP", "help", aliases=("", "support", "docs")),
    LINK_IDENTITY := MessagingIntegrationCommand("LINK_IDENTITY", "link"),
    UNLINK_IDENTITY := MessagingIntegrationCommand("UNLINK_IDENTITY", "unlink"),
    LINK_TEAM := MessagingIntegrationCommand("LINK_TEAM", "link", ("team",)),
    UNLINK_TEAM := MessagingIntegrationCommand("UNLINK_TEAM", "unlink", ("team",)),
)

R = TypeVar("R")  # response


class MessagingIntegrationCommandDispatcher(Generic[R], ABC):
    """The set of commands handled by one messaging integration."""

    @property
    @abstractmethod
    def command_handlers(
        self,
    ) -> Iterable[tuple[MessagingIntegrationCommand, Callable[[CommandInput], R]]]:
        raise NotImplementedError

    def dispatch(self, cmd_input: CommandInput) -> R:
        def parsing_order(
            handler: tuple[MessagingIntegrationCommand, Callable[[CommandInput], R]]
        ) -> int:
            # Sort by descending length of arg tokens, so that we check for required
            # args before defaulting to ones without.
            command, _ = handler
            return -len(command.arg_tokens)

        parsing_sequence = sorted(self.command_handlers, key=parsing_order)
        for (command, callback) in parsing_sequence:
            if command.does_match(cmd_input):
                arg_input = cmd_input.trim_command_args(command)
                return callback(arg_input)
        raise CommandNotMatchedError(f"{cmd_input=!r}", cmd_input)
