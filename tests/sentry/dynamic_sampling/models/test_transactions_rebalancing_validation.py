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
    create_transaction_counts,
)


def test_total_num_classes_mismatch(transactions_rebalancing_model) -> None:
    """
    Simple test case that checks that the model is resilient to cases where the
    reported total number of classes is less than the number of passed classes
    """
    sample_rate = 0.9
    transactions = create_transaction_counts(big=3, med=4, small=2)
    explict_transactions = transactions[0:None]
    total = sum_classes_counts(transactions)
    total_classes = len(transactions)

    trans, global_rate = transactions_rebalancing_model.run(
        TransactionsRebalancingInput(
            classes=explict_transactions,
            sample_rate=sample_rate,
            total_num_classes=total_classes - 1,
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
