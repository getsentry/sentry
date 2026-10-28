import pytest

from sentry.dynamic_sampling.models.common import sum_classes_counts
from sentry.dynamic_sampling.models.transactions_rebalancing import (
    TransactionsRebalancingInput,
    TransactionsRebalancingModel,
)


@pytest.fixture
def transactions_rebalancing_model():
    return TransactionsRebalancingModel()


from tests.sentry.dynamic_sampling.models.test_transactions_rebalancing import (
    excluded_transactions,
    sample_rates,
    test_resample_cases,
)


@pytest.mark.parametrize("sample_rate", sample_rates)
@pytest.mark.parametrize("transactions", test_resample_cases)
@pytest.mark.parametrize("idx_low,idx_high", excluded_transactions)
def test_explicit_elements_ideal_rate(
    transactions_rebalancing_model, sample_rate, transactions, idx_low, idx_high
):
    """
    Tests that the explicitly specified elements are sampled at their ideal rate.

    This test is performed at intensity=1.0
    Ideal sample rate means that the resulting number of sampled elements is the minimum between:
    * all transactions in the class (sampled at rate 1.0)
    * the budget per transaction
    """
    explict_transactions = transactions[idx_low:idx_high]
    total = sum_classes_counts(transactions)
    total_classes = len(transactions)

    trans, global_rate = transactions_rebalancing_model.run(
        TransactionsRebalancingInput(
            classes=explict_transactions,
            sample_rate=sample_rate,
            total_num_classes=total_classes,
            total=total,
            intensity=1,
        ),
    )

    ideal_number_of_elements_per_class = total * sample_rate / total_classes

    trans_dict = {t.id: t.new_sample_rate for t in trans}

    for transaction in explict_transactions:
        count = transaction.count
        actual_rate = trans_dict[transaction.id]

        if ideal_number_of_elements_per_class > count:
            assert actual_rate == 1.0  # tiny transactions not sampled
        else:
            assert (
                actual_rate * count == pytest.approx(ideal_number_of_elements_per_class)
                or actual_rate * count >= ideal_number_of_elements_per_class
            )
