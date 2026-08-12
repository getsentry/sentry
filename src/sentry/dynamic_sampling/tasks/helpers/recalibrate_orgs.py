def compute_adjusted_factor(
    prev_factor: float, effective_sample_rate: float, target_sample_rate: float
) -> float | None:
    """
    Calculates an adjustment factor in order to bring the effective sample rate close to the target sample rate.
    """
    # If the factor is outside the range, we can't do much besides bailing.
    # We also bail, when we don't have a valid effective sample rate.
    if prev_factor <= 0.0 or effective_sample_rate == 0.0:
        return None

    # This formula aims at scaling the factor proportionally to the ratio of the sample rate we are targeting compared
    # to the effective sample rate of that org. An imbalance in the ratio can be introduced by many factors, including
    # biases that oversample or down sample irrespectively of the incoming volume.
    return prev_factor * (target_sample_rate / effective_sample_rate)
