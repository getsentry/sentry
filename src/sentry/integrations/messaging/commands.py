import itertools
from abc import ABC, abstractmethod
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Generic, TypeVar

from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.messaging.spec import MessagingIntegrationSpec
from sentry.integrations.types import EventLifecycleOutcome, IntegrationResponse


@dataclass(frozen=True, eq=True)
class CommandInput:
    cmd_value: str
    arg_values: tuple[str, ...] = ()

    def get_all_tokens(self) -> Iterable[str]:
        yield self.cmd_value
        yield from self.arg_values

    def adjust(self, slug: "CommandSlug") -> "CommandInput":
        """Remove the args that are part of a slug."""
        token_count = len(slug.tokens) - 1
        slug_part = [self.cmd_value] + list(self.arg_values)[:token_count]
        remaining_args = self.arg_values[token_count:]
        return CommandInput(" ".join(slug_part), remaining_args)


class CommandNotMatchedError(Exception):
    def __init__(self, message: str, unmatched_input: CommandInput) -> None:
        super().__init__(message)
        self.unmatched_input = unmatched_input


class CommandSlug:
    def __init__(self, text: str) -> None:
        self.tokens = tuple(token.casefold() for token in text.strip().split())

    def does_match(self, cmd_input: CommandInput) -> bool:
        if not self.tokens:
            return cmd_input.cmd_value == "" and not cmd_input.arg_values
        cmd_prefix = itertools.islice(cmd_input.get_all_tokens(), 0, len(self.tokens))
        cmd_tokens = tuple(token.casefold() for token in cmd_prefix)
        return self.tokens == cmd_tokens

    def __repr__(self):
        joined_tokens = " ".join(self.tokens)
        return f"{type(self).__name__}({joined_tokens!r})"


class MessagingIntegrationCommand:
    def __init__(
        self,
        interaction_type: MessagingInteractionType,
        command_text: str,
        aliases: Iterable[str] = (),
    ) -> None:
        super().__init__()
        self.interaction_type = interaction_type
        self.command_slug = CommandSlug(command_text)
        self.aliases = frozenset(CommandSlug(alias) for alias in aliases)

    @property
    def name(self) -> str:
        return self.interaction_type.value

    @staticmethod
    def _to_tokens(text: str) -> tuple[str, ...]:
        return tuple(token.casefold() for token in text.strip().split())

    def get_all_command_slugs(self) -> Iterable[CommandSlug]:
        yield self.command_slug
        yield from self.aliases


HELP = MessagingIntegrationCommand(
    MessagingInteractionType.HELP,
    "help",
    aliases=("", "support", "docs"),
)
LINK_IDENTITY = MessagingIntegrationCommand(
    MessagingInteractionType.LINK_IDENTITY,
    "link",
)
UNLINK_IDENTITY = MessagingIntegrationCommand(
    MessagingInteractionType.UNLINK_IDENTITY,
    "unlink",
)
LINK_TEAM = MessagingIntegrationCommand(
    MessagingInteractionType.LINK_TEAM,
    "link team",
)
UNLINK_TEAM = MessagingIntegrationCommand(
    MessagingInteractionType.UNLINK_TEAM,
    "unlink team",
)

R = TypeVar("R")  # response

# Command handler type that receives lifecycle object
CommandHandler = Callable[[CommandInput], IntegrationResponse[R]]


class MessagingIntegrationCommandDispatcher(Generic[R], ABC):
    """The set of commands handled by one messaging integration."""

    @property
    @abstractmethod
    def integration_spec(self) -> MessagingIntegrationSpec:
        raise NotImplementedError

    @property
    @abstractmethod
    def command_handlers(
        self,
    ) -> Iterable[tuple[MessagingIntegrationCommand, CommandHandler[R]]]:
        """Return list of (command, handler) tuples.

        Each handler receives (command_input) and returns IntegrationResponse[R].
        """
        raise NotImplementedError

    """
    Handlers for bot commands which should wrap the EventLifecycle context.
    """

    def get_event(self, command: MessagingIntegrationCommand) -> MessagingInteractionEvent:
        return MessagingInteractionEvent(
            interaction_type=command.interaction_type, spec=self.integration_spec
        )

    def dispatch(self, cmd_input: CommandInput) -> R:
        @dataclass(frozen=True)
        class CandidateHandler:
            command: MessagingIntegrationCommand
            slug: CommandSlug
            callback: CommandHandler[R]

            def parsing_order(self) -> int:
                # Sort by descending length of arg tokens. If one slug is a prefix of
                # another (e.g., "link" and "link team"), we must check for the longer
                # one first.
                return -len(self.slug.tokens)

        candidate_handlers = [
            CandidateHandler(command, slug, callback)
            for (command, callback) in self.command_handlers
            for slug in command.get_all_command_slugs()
        ]
        candidate_handlers.sort(key=CandidateHandler.parsing_order)

        for handler in candidate_handlers:
            if handler.slug.does_match(cmd_input):
                arg_input = cmd_input.adjust(handler.slug)
                event = self.get_event(handler.command)
                with event.capture(assume_success=False) as lifecycle:
                    response = handler.callback(arg_input)
                    # Record the appropriate lifecycle event based on the response
                    if response.interaction_result == EventLifecycleOutcome.HALTED:
                        lifecycle.record_halt(response.outcome_reason, response.context_data)
                    elif response.interaction_result == EventLifecycleOutcome.FAILURE:
                        lifecycle.record_failure(response.outcome_reason, response.context_data)
                    else:
                        lifecycle.record_success()
                    return response.response

        raise CommandNotMatchedError(f"{cmd_input=!r}", cmd_input)
