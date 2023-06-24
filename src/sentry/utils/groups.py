from statemachine import State, StateMachine


class GroupStatusMachine(StateMachine):
    # States
    unresolved_new = State(initial=True)
    unresolved_ongoing = State()
    unresolved_escalating = State()
    unresolved_regressed = State()

    archived_until_escalating = State()
    archived_until_condition_met = State()
    archived_forever = State()

    resolved = State()
    pending_deletion = State()
    deletion_in_progress = State()
    pending_merge = State()
    reprocessing = State()

    # Transitions
    new_issue = unresolved_new.to.itself()
    ongoing_issue = (
        unresolved_new.to(unresolved_ongoing)
        | unresolved_escalating.to(unresolved_ongoing)
        | unresolved_regressed.to(unresolved_ongoing)
        | archived_until_escalating.to(unresolved_ongoing)
        | archived_until_condition_met.to(unresolved_ongoing)
        | archived_forever.to(unresolved_ongoing)
    )

    # Issue Archiving
    archive_issue_until_escalating = (
        unresolved_new.to(archived_until_escalating)
        | unresolved_ongoing.to(archived_until_escalating)
        | unresolved_regressed.to(archived_until_escalating)
        | unresolved_escalating.to(archived_until_escalating)
    )
    archive_issue_forever = (
        unresolved_new.to(archived_forever)
        | unresolved_ongoing.to(archived_forever)
        | unresolved_regressed.to(archived_forever)
        | unresolved_escalating.to(archived_forever)
    )
    archive_issue_until_condition_met = (
        unresolved_new.to(archived_until_condition_met)
        | unresolved_ongoing.to(archived_until_condition_met)
        | unresolved_regressed.to(archived_until_condition_met)
        | unresolved_escalating.to(archived_until_condition_met)
    )

    escalate_issue = archived_until_escalating.to(
        unresolved_escalating, cond="is_escalating"
    ) | archive_issue_until_condition_met.to(unresolved_escalating, cond="is_escalating")

    #
    resolve_issue = (
        unresolved_new.to(resolved)
        | unresolved_ongoing.to(resolved)
        | unresolved_escalating.to(resolved)
        | unresolved_regressed.to(resolved)
        | archived_until_escalating.to(resolved)
    )

    regress_issue = resolved.to(unresolved_regressed)

    def __init__():
        super().__init__()

    def before_cycle(self, event: str, source: State, target: State, message: str = ""):
        message = ". " + message if message else ""
        return f"Running {event} from {source.id} to {target.id}{message}"
