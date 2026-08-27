"""
Does the recalibration factor settle on the target sample rate, or does it oscillate?

Recalibration is a feedback loop. Each pass measures the sample rate the organization
actually got over the last window, divides the target by it, and multiplies that into the
factor relay applies. This simulation drives ``calculate_recalibration_factor``, the
production function, and sweeps the gain it takes from
``dynamic-sampling.recalibration.damping-gain``. At the default gain of 1.0 the whole
correction lands in one step.

That is only safe when the factor being divided out is the factor that produced the
measurement. The per-org pipeline reads it from Redis at write time (``configuration.py``,
``recalibrate``), which is the factor of the *previous* pass, and the previous pass is only
reflected in the window once relay has picked it up. Every cycle of delay between the two
is a cycle of lag in the loop, and this simulation is about what that lag costs.

What the report shows: with no lag the loop is dead-beat and lands on target in one step.
With one cycle of lag it never lands at all -- the factor cycles through six values forever
and the organization's volume rides a wave around the target. A gain below 1 damps that,
at the price of taking longer to converge, and no gain converges as fast as removing the
lag does. The last section compares against dividing out the factor that was really live
during the window, which needs no gain and settles at any lag.

Run it as a report::

    .venv/bin/pytest -sq tests/sentry/dynamic_sampling/per_org/test_recalibration_stability_simulation.py -k report
"""

from __future__ import annotations

import math
import random
import statistics
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass

import pytest

from sentry.dynamic_sampling.per_org.calculations import calculate_recalibration_factor
from sentry.dynamic_sampling.per_org.scheduler import CYCLE_DURATION
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.dynamic_sampling.tasks.constants import MAX_REBALANCE_FACTOR, MIN_REBALANCE_FACTOR

SEED = 1234
ORG_ID = 1
# Large enough that rounding the measured rate into integer counts changes nothing. Noise,
# where the report asks for it, is injected explicitly instead.
WINDOW_VOLUME = 10_000_000
CYCLES = 60
# The error band an organization is considered settled inside, and how long it has to hold
# it. Once the loop is inside the band it stays there, so this is a convergence time. The
# hold is longer than the six-cycle period of the undamped loop, so that a run ending on
# one of the two cycles that period passes through target does not read as settled.
SETTLED_TOLERANCE = 0.01
SETTLED_HOLD = 10


@dataclass(frozen=True)
class Plant:
    """
    The organization the loop is steering.

    ``structural_rate`` is the sample rate the biases land on with the factor at 1: the
    published project and transaction rates, plus everything the pipeline cannot model --
    latest release boosts, client-side rates, trace rules. Recalibration exists to close
    the gap between it and ``target_rate``.
    """

    target_rate: float
    structural_rate: float

    @property
    def settled_factor(self) -> float:
        return self.target_rate / self.structural_rate


# 30% over target is a routine miss for an org whose biases keep more than the model
# assumes. The report sweeps the interesting axis (lag and gain), not this one.
DEFAULT_PLANT = Plant(target_rate=0.10, structural_rate=0.13)


def measure(plant: Plant, applied_factor: float, noise: float, rng: random.Random) -> float:
    """
    The volume one window of traffic produces under ``applied_factor``.

    ``total`` is EAP's extrapolated count and ``indexed`` its stored count, the two fields
    ``calculate_recalibration_factor`` divides. ``noise`` stands for the spread of that
    extrapolated estimate, which the legacy generic-metrics count did not have.
    """
    effective_rate = plant.structural_rate * applied_factor
    if noise:
        effective_rate *= 1 + rng.gauss(0.0, noise)
    effective_rate = min(max(effective_rate, 1e-6), 1.0)
    return effective_rate


def to_volume(effective_rate: float) -> OrganizationDataVolume:
    return OrganizationDataVolume(
        org_id=ORG_ID,
        total=WINDOW_VOLUME,
        indexed=round(WINDOW_VOLUME * effective_rate),
    )


def store(factor: float | None) -> float:
    """
    What the next pass reads back, following ``cache.write_recalibration_factor``: a factor
    outside the rebalance bounds is deleted, and a deleted factor reads back as 1.0.
    """
    if factor is None:
        return 1.0
    if MIN_REBALANCE_FACTOR <= factor <= MAX_REBALANCE_FACTOR:
        return factor
    return 1.0


Controller = Callable[[float, float, OrganizationDataVolume, Plant], float]


def damped(gain: float) -> Controller:
    """
    Production's correction at ``gain``, the value behind
    ``dynamic-sampling.recalibration.damping-gain``.

    A gain of 1.0 is production as it stands today: the whole correction is applied at
    once. Below 1.0 only part of it is, which is what keeps the loop from overshooting when
    it cannot see the effect of its last move yet.
    """

    def control(
        stored_factor: float,
        applied_factor: float,
        volume: OrganizationDataVolume,
        plant: Plant,
    ) -> float:
        factor = calculate_recalibration_factor(volume, stored_factor, plant.target_rate, gain=gain)
        return stored_factor if factor is None else factor

    return control


def stamped(
    stored_factor: float,
    applied_factor: float,
    volume: OrganizationDataVolume,
    plant: Plant,
) -> float:
    """
    Production's correction, dividing out the factor that was live during the window
    rather than the one sitting in Redis. Needs the factor to be stored with the time it
    took effect, so that the window can start after it.
    """
    factor = calculate_recalibration_factor(volume, applied_factor, plant.target_rate)
    return stored_factor if factor is None else factor


@dataclass(frozen=True)
class Run:
    label: str
    lag: int
    errors: list[float]
    factors: list[float]

    @property
    def settled_at(self) -> int | None:
        """The first cycle after which the error never leaves the band again."""
        for cycle in range(len(self.errors) - SETTLED_HOLD):
            if all(abs(error) <= SETTLED_TOLERANCE for error in self.errors[cycle:]):
                return cycle
        return None

    @property
    def peak_error(self) -> float:
        """The worst error once the first response to the initial miss has passed."""
        return max(abs(error) for error in self.errors[3:])

    @property
    def steady_error(self) -> float:
        """Root mean square error over the back half, once any transient is gone."""
        tail = self.errors[len(self.errors) // 2 :]
        return math.sqrt(statistics.fmean(error**2 for error in tail))


def simulate(
    controller: Controller,
    lag: int,
    plant: Plant = DEFAULT_PLANT,
    noise: float = 0.0,
    cycles: int = CYCLES,
    label: str = "",
) -> Run:
    """
    Run the loop for ``cycles`` passes.

    ``lag`` is how many passes go by before a written factor reaches the window that
    measures it. At 0 the pass that writes a factor is the last one before it takes effect,
    which is what the pipeline assumes. At 1 the window still sees the factor before it.
    """
    rng = random.Random(SEED)
    served = [1.0] * (lag + 1)
    stored_factor = 1.0
    errors: list[float] = []
    factors: list[float] = []

    for _ in range(cycles):
        applied_factor = served[-1 - lag]
        effective_rate = measure(plant, applied_factor, noise, rng)
        errors.append(effective_rate / plant.target_rate - 1)
        factors.append(applied_factor)

        stored_factor = store(
            controller(stored_factor, applied_factor, to_volume(effective_rate), plant)
        )
        served.append(stored_factor)

    return Run(label=label, lag=lag, errors=errors, factors=factors)


GAINS = (1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.1)
LAGS = (0, 1, 2, 3)


def format_settled(run: Run) -> str:
    return "never" if run.settled_at is None else str(run.settled_at)


def format_trace(runs: Sequence[Run], shown: int = 14) -> str:
    lines = [
        f"{'':<30}" + "".join(f"{cycle:>7}" for cycle in range(shown)),
        f"{'':<30}" + "-" * (7 * shown),
    ]
    for run in runs:
        lines.append(
            f"{run.label:<30}" + "".join(f"{error:>+7.0%}" for error in run.errors[:shown])
        )
    return "\n".join(lines)


SWEEP_HEADER = f"{'gain':>6}" + "".join(f"{f'lag {lag}':>18}" for lag in LAGS)


def format_sweep(noise: float = 0.0) -> str:
    lines = [
        "",
        f"Cycles to settle inside {SETTLED_TOLERANCE:.0%} of target, and the worst error on the way",
        f"(shown as settle/peak). One cycle is {int(CYCLE_DURATION.total_seconds() // 60)} minutes.",
        SWEEP_HEADER,
        "-" * len(SWEEP_HEADER),
    ]
    for gain in GAINS:
        cells = []
        for lag in LAGS:
            run = simulate(damped(gain), lag, noise=noise)
            cells.append(f"{format_settled(run)}/{run.peak_error:.0%}")
        lines.append(f"{gain:>6.2f}" + "".join(f"{cell:>18}" for cell in cells))
    return "\n".join(lines)


def format_noise_sweep() -> str:
    """
    How much of the measurement spread each gain lets through to the served rate.

    The per-org pipeline measures the effective rate as EAP's stored count over its
    extrapolated count, which is an estimate. The legacy pipeline counted incoming
    transactions in generic metrics before the sampling decision, which was exact. An
    undamped loop passes that spread straight through and wanders on it.
    """
    noises = (0.0, 0.01, 0.02, 0.05, 0.10)
    header = f"{'gain':>6}" + "".join(f"{f'sigma {noise:.0%}':>12}" for noise in noises)
    lines = [
        "",
        "Steady-state error of the served rate, against the spread of the measurement.",
        "Root mean square over the back half of the run, at one cycle of lag.",
        header,
        "-" * len(header),
    ]
    for gain in GAINS:
        cells = [
            f"{simulate(damped(gain), lag=1, noise=noise).steady_error:>11.1%}" for noise in noises
        ]
        lines.append(f"{gain:>6.2f}" + "".join(cells))
    return "\n".join(lines)


def format_report() -> str:
    plant = DEFAULT_PLANT
    lines = [
        "Recalibration loop stability.",
        f"Target rate {plant.target_rate:.0%}. The biases land on {plant.structural_rate:.0%} "
        f"with the factor at 1, so the factor has to settle on {plant.settled_factor:.3f}.",
        f"Numbers are the served rate's error against target, per cycle. "
        f"One cycle is {int(CYCLE_DURATION.total_seconds() // 60)} minutes.",
        "",
        "No lag: the pass that writes a factor is the last one before relay applies it.",
        "This is what the pipeline assumes, and here the loop is dead-beat.",
        format_trace(
            [
                simulate(damped(1.0), lag=0, label="  production (gain 1.0)"),
                simulate(damped(0.3), lag=0, label="  gain 0.3"),
            ]
        ),
        "",
        "One cycle of lag: the window still sees the factor from the pass before.",
        "Production never settles. The six-value cycle is the sawtooth.",
        format_trace(
            [
                simulate(damped(gain), lag=1, label=f"  gain {gain:.2f}")
                for gain in (1.0, 0.6, 0.4, 0.3, 0.2)
            ]
        ),
        "",
        "Two cycles of lag.",
        format_trace(
            [
                simulate(damped(gain), lag=2, label=f"  gain {gain:.2f}")
                for gain in (1.0, 0.6, 0.4, 0.3, 0.2)
            ]
        ),
        "",
        "The factor itself, at one cycle of lag, undamped. Six values, repeating.",
        f"{'':<30}"
        + "".join(f"{factor:>7.3f}" for factor in simulate(damped(1.0), lag=1).factors[:14]),
        format_sweep(),
        format_noise_sweep(),
        "",
        "Dividing out the factor that was live during the window instead of the stored one.",
        "No gain to pick, and it settles at every lag.",
        format_trace([simulate(stamped, lag=lag, label=f"  stamped, lag {lag}") for lag in LAGS]),
    ]
    return "\n".join(lines)


def test_print_recalibration_stability_report() -> None:
    sys.stdout.write(f"\n{format_report()}\n")


def test_the_loop_is_dead_beat_when_the_factor_is_live_before_its_window() -> None:
    # The correction is the whole ratio of target to measured rate, so one application of
    # it lands exactly on target -- provided the rate it divided out is the rate that
    # produced the measurement. This is the case the production formula is written for.
    run = simulate(damped(1.0), lag=0)

    assert run.settled_at == 1
    assert run.factors[-1] == pytest.approx(DEFAULT_PLANT.settled_factor)


def test_one_cycle_of_lag_makes_the_undamped_loop_oscillate_forever() -> None:
    # With a cycle of lag the update becomes f(n+1) = f(n) - f(n-1) + k in log space. Its
    # roots sit on the unit circle at plus and minus 60 degrees, so nothing decays and the
    # loop repeats every six cycles. This is the sawtooth, and it does not heal itself.
    run = simulate(damped(1.0), lag=1)

    assert run.settled_at is None
    assert run.peak_error > 0.25
    # Rounding the measured rate into a whole stored count keeps the repeat from being
    # exact, so the tolerance is loose enough to see past it and tight enough that only a
    # genuine period of six passes.
    for cycle in range(12, CYCLES - 6):
        assert run.errors[cycle] == pytest.approx(run.errors[cycle + 6], abs=1e-4)


@pytest.mark.parametrize("lag", [1, 2])
def test_a_gain_below_one_settles_the_loop(lag: int) -> None:
    # Taking only part of the correction each pass pulls the roots inside the unit circle.
    # At a gain of 0.25 and below they are real, so the loop approaches target without
    # crossing it.
    run = simulate(damped(0.3), lag=lag)

    assert run.settled_at is not None
    assert run.settled_at < CYCLES // 2


def test_no_gain_converges_as_fast_as_removing_the_lag() -> None:
    # Worth knowing before tuning the gain: it buys stability, not speed. The best gain at
    # one cycle of lag still takes several times longer than the dead-beat loop, and the
    # ordering is not monotonic -- a higher gain overshoots and spends the cycles it saved.
    settled = {gain: simulate(damped(gain), lag=1).settled_at for gain in GAINS if gain < 1.0}
    best = min(cycles for cycles in settled.values() if cycles is not None)

    assert best > simulate(damped(1.0), lag=0).settled_at * 3


@pytest.mark.parametrize("lag", LAGS)
def test_dividing_out_the_live_factor_settles_at_every_lag(lag: int) -> None:
    # The lag stops mattering once the loop divides by the factor that produced the
    # measurement: the pass still lands on target in one step, it just has to wait for a
    # window that a single known factor covers.
    run = simulate(stamped, lag=lag)

    assert run.settled_at == lag + 1
    assert run.factors[-1] == pytest.approx(DEFAULT_PLANT.settled_factor)


def test_a_lower_gain_passes_less_measurement_spread_to_the_served_rate() -> None:
    # EAP measures the effective rate as a ratio of a stored count to an extrapolated one,
    # which carries spread that the legacy pre-sampling count did not. An undamped loop
    # writes that spread straight into the factor.
    undamped_wander = simulate(damped(1.0), lag=1, noise=0.05).steady_error
    damped_wander = simulate(damped(0.3), lag=1, noise=0.05).steady_error

    assert damped_wander < undamped_wander / 2
