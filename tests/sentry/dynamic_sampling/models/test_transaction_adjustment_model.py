import pytest

from sentry.dynamic_sampling.models.transaction_adjustment_model import (
    adjust_sample_rate,
    get_num_sampled_elements,
    get_total,
)


def create_transaction_counts(big: int, med: int, small: int):
    big_t = [(f"tb{i}", 1000 + i) for i in range(big)]
    med_t = [(f"tm{i}", 100 + i) for i in range(med)]
    small_t = [(f"ts{i}", 1 + i) for i in range(small)]
    return [*big_t, *med_t, *small_t]


test_resample_cases = [
    create_transaction_counts(big=3, med=4, small=2),
    create_transaction_counts(big=6, med=0, small=2),
    create_transaction_counts(big=3, med=0, small=4),
    create_transaction_counts(big=3, med=100, small=3),
    create_transaction_counts(big=3, med=100, small=30),
    create_transaction_counts(big=30, med=10, small=30),
    create_transaction_counts(big=30, med=3, small=5),
]
sample_rates = [0.01, 0.1, 0.5, 0.9, 0.99, 1.0]
excluded_transactions = [
    (0, None),  # full resample
    (3, None),  # exclude first 3
    (0, -3),  # exclude last 3
    (3, -3),  # take 3 from both ends
]


@pytest.mark.parametrize("sample_rate", sample_rates)
@pytest.mark.parametrize("transactions", test_resample_cases)
@pytest.mark.parametrize("idx_low,idx_high", excluded_transactions)
def test_maintains_overall_sample_rate(sample_rate, transactions, idx_low, idx_high):
    """
    Tests that the overall sampling rate is maintained after applying new rates
    """
    explict_transactions = transactions[idx_low:idx_high]
    total = get_total(transactions)
    total_classes = len(transactions)

    trans, global_rate = adjust_sample_rate(
        explict_transactions, sample_rate, total_num_classes=total_classes, total=total
    )

    # make sure we maintain the required sample rate
    old_sampled_transactions = get_num_sampled_elements(transactions, {}, sample_rate)
    new_sampled_transactions = get_num_sampled_elements(transactions, trans, global_rate)

    assert new_sampled_transactions == pytest.approx(old_sampled_transactions)


@pytest.mark.parametrize("sample_rate", sample_rates)
@pytest.mark.parametrize("transactions", test_resample_cases)
@pytest.mark.parametrize("idx_low,idx_high", excluded_transactions)
def test_explicit_elements_ideal_rate(sample_rate, transactions, idx_low, idx_high):
    """
    Tests that the explicitly specified elements are sampled at their ideal rate.

    Ideal sample rate means that the resulting number of sampled elements is the minimum between:
    * all transactions in the class (sampled at rate 1.0)
    * the budget per transaction
    """
    explict_transactions = transactions[idx_low:idx_high]
    total = get_total(transactions)
    total_classes = len(transactions)

    trans, global_rate = adjust_sample_rate(
        explict_transactions, sample_rate, total_num_classes=total_classes, total=total
    )

    ideal_number_of_elements_per_class = total * sample_rate / total_classes

    for name, count in explict_transactions:
        actual_rate = trans[name]

        if ideal_number_of_elements_per_class > count:
            assert actual_rate == 1.0  # tiny transactions not sampled
        else:
            assert (
                actual_rate * count == pytest.approx(ideal_number_of_elements_per_class)
                or actual_rate * count >= ideal_number_of_elements_per_class
            )
