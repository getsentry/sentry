from .assigned import AssignedActivityTemplate
from .note import NoteActivityTemplate
from .seer.coding_completed import SeerCodingCompletedActivityTemplate
from .seer.coding_started import SeerCodingStartedActivityTemplate
from .seer.iteration_completed import SeerIterationCompletedActivityTemplate
from .seer.iteration_started import SeerIterationStartedActivityTemplate
from .seer.pr_created import SeerPrCreatedActivityTemplate
from .seer.rca_completed import SeerRcaCompletedActivityTemplate
from .seer.rca_started import SeerRcaStartedActivityTemplate
from .seer.solution_completed import SeerSolutionCompletedActivityTemplate
from .seer.solution_started import SeerSolutionStartedActivityTemplate
from .status_change.set_escalating import SetEscalatingActivityTemplate
from .status_change.set_ignored import SetIgnoredActivityTemplate
from .status_change.set_regression import SetRegressionActivityTemplate
from .status_change.set_resolved import SetResolvedActivityTemplate
from .status_change.set_resolved_by_age import SetResolvedByAgeActivityTemplate
from .status_change.set_resolved_in_commit import SetResolvedInCommitActivityTemplate
from .status_change.set_resolved_in_release import SetResolvedInReleaseActivityTemplate
from .status_change.set_unresolved import SetUnresolvedActivityTemplate
from .unassigned import UnassignedActivityTemplate

__all__ = (
    "SeerRcaStartedActivityTemplate",
    "SeerRcaCompletedActivityTemplate",
    "SeerSolutionStartedActivityTemplate",
    "SeerSolutionCompletedActivityTemplate",
    "SeerCodingStartedActivityTemplate",
    "SeerCodingCompletedActivityTemplate",
    "SeerPrCreatedActivityTemplate",
    "SeerIterationStartedActivityTemplate",
    "SeerIterationCompletedActivityTemplate",
    "SetResolvedActivityTemplate",
    "SetResolvedInReleaseActivityTemplate",
    "SetResolvedByAgeActivityTemplate",
    "SetResolvedInCommitActivityTemplate",
    "SetEscalatingActivityTemplate",
    "SetIgnoredActivityTemplate",
    "SetRegressionActivityTemplate",
    "SetUnresolvedActivityTemplate",
    "AssignedActivityTemplate",
    "UnassignedActivityTemplate",
    "NoteActivityTemplate",
)
