from statemachine import State, StateMachine


class GroupStatusMachine(StateMachine):
    "A traffic light machine"
    unresolved_new = State(initial=True)
    unresolved_ongoing = State()
    archived_until_escalating = State()
    unresolved_escalating = State()
    resolved = State()
    unresolved_regression = State()

    new_issue = unresolved_new.to.itself()
    ongoing_issue = unresolved_new.to(unresolved_ongoing)
    archive_issue = (
        unresolved_new.to(archived_until_escalating)
        | unresolved_ongoing.to(archived_until_escalating)
        | unresolved_regression.to(archived_until_escalating)
        | unresolved_escalating.to(archived_until_escalating)
    )
    escalate_issue = archived_until_escalating.to(unresolved_escalating, cond="is_escalating")
    resolve_issue = (
        unresolved_new.to(resolved)
        | unresolved_ongoing.to(resolved)
        | unresolved_escalating.to(resolved)
        | unresolved_regression.to(resolved)
        | archived_until_escalating.to(resolved)
    )
    regress_issue = resolved.to(unresolved_regression)

    def __init__():
        super().__init__()

    def is_escalating(self):
        """Is group escalating"""
        return True

    def before_cycle(self, event: str, source: State, target: State, message: str = ""):
        message = ". " + message if message else ""
        return f"Running {event} from {source.id} to {target.id}{message}"
