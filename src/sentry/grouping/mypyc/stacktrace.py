from typing import TYPE_CHECKING, Any, MutableMapping, Optional

if TYPE_CHECKING:
    from .rule import Rule


class StacktraceState:
    def __init__(self) -> None:
        self.vars = {"max-frames": 0, "min-frames": 0, "invert-stacktrace": 0}
        self.setters: MutableMapping[str, "Rule"] = {}

    def set(self, var: str, value: Any, rule: Optional["Rule"] = None) -> None:
        self.vars[var] = value
        if rule is not None:
            self.setters[var] = rule

    def get(self, var: str) -> Any:
        return self.vars.get(var)

    def describe_var_rule(self, var: str) -> Optional[str]:
        rule = self.setters.get(var)

        return rule.matcher_description if rule else None

    def add_to_hint(self, hint: str, var: Any) -> str:
        description = self.describe_var_rule(var)
        if description is None:
            return hint
        return f"{hint} by stack trace rule ({description})"
