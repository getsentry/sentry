import pytest

from flagpole import ExperimentMode


def test_simple_assignment() -> None:
    assert ExperimentMode("simple").get_assignment(True) == "active"
    assert ExperimentMode("simple").get_assignment(False) == "control"


def test_unknown_mode_is_rejected() -> None:
    with pytest.raises(ValueError):
        ExperimentMode("multivariate")
