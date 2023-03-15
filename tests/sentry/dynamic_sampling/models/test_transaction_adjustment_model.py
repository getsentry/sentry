import pytest

from sentry.dynamic_sampling.models.transaction_adjustment_model import (
    adjust_sample_rate,
    get_num_sampled_transactions,
    total_transactions,
)


def transactions(big: int, med: int, small: int):
    big_t = [(f"tb{i}", 1000 + i) for i in range(big)]
    med_t = [(f"tm{i}", 100 + i) for i in range(med)]
    small_t = [(f"ts{i}", 1 + i) for i in range(small)]
    return [*big_t, *med_t, *small_t]


test_resample_cases = [
    transactions(big=3, med=0, small=2),
    transactions(big=6, med=0, small=2),
    transactions(big=3, med=0, small=0),
    transactions(big=3, med=100, small=3),
    transactions(big=3, med=100, small=30),
    transactions(big=30, med=10, small=30),
]


@pytest.mark.parametrize("sample_rate", [0.1, 0.5, 0.9, 1.0])
@pytest.mark.parametrize("transactions", test_resample_cases)
def test_maintains_overall_sample_rate(sample_rate, transactions):

    MAX_EXPLICIT_TRANSACTIONS = 3
    trans, global_rate = adjust_sample_rate(transactions, sample_rate, MAX_EXPLICIT_TRANSACTIONS)

    assert len(trans) == MAX_EXPLICIT_TRANSACTIONS

    # make sure we maintain the required sample rate
    old_sampled_transactions = get_num_sampled_transactions(transactions, {}, sample_rate)
    new_sampled_transactions = get_num_sampled_transactions(transactions, trans, global_rate)

    assert old_sampled_transactions == pytest.approx(new_sampled_transactions)


small_transactions = [
    [
        ("tb1", 200),
        ("tb2", 300),
        ("tb3", 400),
        ("tb4", 400),
        ("tb5", 400),
        ("tb6", 400),
        ("ts1", 7),
        ("ts2", 4),
        ("ts3", 7),
    ],
]


@pytest.mark.parametrize("sample_rate", [0.1, 0.5])
@pytest.mark.parametrize("transactions", small_transactions)
def test_few_small_transactions(sample_rate, transactions):
    """
    Test that when we only have a few small transactions, they are sampled at
    their ideal size and the rest is globally adjusted
    """
    MAX_EXPLICIT_TRANSACTIONS = 3
    explicit_transactions, global_rate = adjust_sample_rate(
        transactions, sample_rate, MAX_EXPLICIT_TRANSACTIONS
    )

    assert len(explicit_transactions) == MAX_EXPLICIT_TRANSACTIONS
    # make sure we maintain the required sample rate
    old_sampled_transactions = get_num_sampled_transactions(transactions, {}, sample_rate)
    new_sampled_transactions = get_num_sampled_transactions(
        transactions, explicit_transactions, global_rate
    )
    assert old_sampled_transactions == pytest.approx(new_sampled_transactions)

    # check that we selected the small transactions and that they are sample at the ideal rate
    transactions = sorted(transactions, key=lambda x: x[1])
    smallest = transactions[:MAX_EXPLICIT_TRANSACTIONS]

    num_transactions = total_transactions(transactions)
    total_budget = num_transactions * sample_rate
    num_transactions_rate_1 = 0
    # the budget per transaction is calculated excluding the transactions that are sampled at 1
    for name, count in smallest:
        assert name in explicit_transactions
        rate = explicit_transactions[name]
        if rate == 1:
            total_budget -= count
            num_transactions_rate_1 += 1

    budget_per_transaction = total_budget / (len(transactions) - num_transactions_rate_1)
    # now check that all explicit transactions that are not sampled at 1 are sampled
    # at their optimal rate
    for name, count in smallest:
        rate = explicit_transactions[name]
        if rate != 1:
            assert rate * count == pytest.approx(budget_per_transaction)


big_transactions = [
    [
        ("tb1", 1000),
        ("tb2", 3000),
        ("tb3", 4000),
        ("tm1", 40),
        ("tm2", 50),
        ("ts1", 7),
        ("ts2", 4),
        ("ts3", 7),
    ],
]


@pytest.mark.parametrize("sample_rate", [0.1, 0.5])
@pytest.mark.parametrize("transactions", big_transactions)
def test_few_big_transactions(sample_rate, transactions):
    """
    Test that when we only have a few bit transactions,
    they are sampled at their ideal size and the
    rest is globally adjusted
    """
    MAX_EXPLICIT_TRANSACTIONS = 3
    explicit_transactions, global_rate = adjust_sample_rate(
        transactions, sample_rate, MAX_EXPLICIT_TRANSACTIONS
    )

    assert len(explicit_transactions) == MAX_EXPLICIT_TRANSACTIONS
    # make sure we maintain the required sample rate
    old_sampled_transactions = get_num_sampled_transactions(transactions, {}, sample_rate)
    new_sampled_transactions = get_num_sampled_transactions(
        transactions, explicit_transactions, global_rate
    )
    assert old_sampled_transactions == pytest.approx(new_sampled_transactions)

    # check that we selected the small transactions and that they are sample at the ideal rate
    transactions = sorted(transactions, key=lambda x: x[1])
    largest = transactions[-MAX_EXPLICIT_TRANSACTIONS:]

    for name, count in largest:
        assert name in explicit_transactions


full_resample_transactions = [
    [("tb1", 1000), ("tm1", 100), ("tm2", 200), ("ts1", 5)],
    [("tb1", 1000), ("tb2", 2000), ("ts1", 2), ("ts2", 5)],
    [("tb1", 1000), ("tb2", 1100), ("tb3", 2000), ("tb4", 5000)],
]


@pytest.mark.parametrize("sample_rate", [0.1, 0.5, 0.9, 1.0])
@pytest.mark.parametrize("transactions", full_resample_transactions)
def test_full_resample(sample_rate, transactions):
    """
    Test that when we can adjust all transactions we adjust them
    either at rate=1.0 or at a sampling rate that generates
    an ideal number of samples.
    """

    num_explicit_transaction_types = len(transactions)
    explicit_transactions, global_rate = adjust_sample_rate(
        transactions, sample_rate, num_explicit_transaction_types
    )

    assert len(explicit_transactions) == num_explicit_transaction_types
    # make sure we maintain the required sample rate
    old_sampled_transactions = get_num_sampled_transactions(transactions, {}, sample_rate)
    new_sampled_transactions = get_num_sampled_transactions(
        transactions, explicit_transactions, global_rate
    )
    assert old_sampled_transactions == pytest.approx(new_sampled_transactions)

    # check that transactions are either sampled at 1 or their ideal rate
    num_transaction_types_fully_sampled = 0
    full_budget = total_transactions(transactions) * sample_rate
    for name, count in transactions:
        # everything should be explicitly specified
        assert name in explicit_transactions
        rate = explicit_transactions[name]
        if rate == 1.0:
            num_transaction_types_fully_sampled += 1
            full_budget -= count

    if num_transaction_types_fully_sampled == num_explicit_transaction_types:
        # all transactions sampled at 1.0 this means we must have specified the
        # overall sample rate to be 1.0
        assert sample_rate == 1.0
    else:
        budget_per_transaction_type = full_budget / (
            num_explicit_transaction_types - num_transaction_types_fully_sampled
        )
        # everything that is not fully sampled should be at budget_per_transaction_type
        for name, count in transactions:
            # everything should be explicitly specified
            assert name in explicit_transactions
            rate = explicit_transactions[name]
            if rate != 1.0:
                assert rate * count == pytest.approx(budget_per_transaction_type)
