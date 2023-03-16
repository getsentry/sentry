import operator
from collections import namedtuple
from copy import copy
from typing import List, Mapping, MutableMapping, Tuple

AdjustedSampleRate = namedtuple("AdjustedSampleRate", "explicit_rates, global_rate")


def adjust_sample_rate(
    transactions: List[Tuple[str, int]], rate: float, max_explicit_transactions: int
) -> Tuple[Mapping[str, float], float]:
    """
    Calculates transaction sample size in order to maximize the number of small transactions

    :param transactions: the transaction types as an array of (name, count) tuples
    :param rate: the overall desired rate
    :param max_explicit_transactions: the maximum number of transactions that can have individual
        rates set, the rest will have a common rate
    :return: a tuple with the first element a mapping transaction-name->sampling-rate and the
    second element the transaction rate for all other transactions (that are not in the dict)
    """
    # sort by transaction count
    transactions = sorted(transactions, key=operator.itemgetter(1))
    if len(transactions) <= max_explicit_transactions:
        # we can get the ideal rate to all do a full resample
        return AdjustedSampleRate(
            explicit_rates=adjust_sample_rate_full(transactions, rate), global_rate=rate
        )

    # TODO I think we can find out which is the best option by looking at the distribution
    #   if we compare the smallest rate with the max_explicit_rate_1 rate and the ratio is
    #   around  1/rate then I think it is safe to go with resample_min otherwise resample_max
    #   need to investigate and refine this idea.

    # See what's gives better results, setting the rate of the smallest transactions or of
    # the largest transactions (if we have just a few very large transactions is better to
    # give them individual rates), if we have a few very small transactions we are better off
    # specifying sample rate for the small transactions.
    # The way we evaluate what's best is by maximizing the minimum number of samples returned
    # by a transaction which is not sampled at 1.0
    min_sample_size_x, explicit_rates_x, global_rate_x = adjust_sample_rate_max(
        transactions, rate, max_explicit_transactions
    )

    min_sample_size_n, explicit_rates_n, global_rate_n = adjust_sample_rate_min(
        transactions, rate, max_explicit_transactions
    )

    if min_sample_size_n < min_sample_size_x:
        return AdjustedSampleRate(explicit_rates=explicit_rates_x, global_rate=global_rate_x)
    else:
        return AdjustedSampleRate(explicit_rates=explicit_rates_n, global_rate=global_rate_n)


def adjust_sample_rate_full(
    transactions: List[Tuple[str, int]], rate: float
) -> MutableMapping[str, float]:
    """
    resample all transactions to their ideal size
    """
    transactions = copy(transactions)
    ret_val = {}
    num_transactions = total_transactions(transactions)
    # calculate how many transactions we are allowed to keep overall
    # this will allow us to pass transactions between different transaction types
    total_budget = num_transactions * rate
    while transactions:
        num_types = len(transactions)
        # We recalculate the budget per type every iteration to
        # account for the cases where, in the previous step we couldn't
        # spend all the allocated budget for that type.
        budget_per_transaction_type = total_budget / num_types
        name, count = transactions.pop(0)
        if count < budget_per_transaction_type:
            # we have fewer transactions in this type than the
            # budget, all we can do is to keep everything
            ret_val[name] = 1.0  # not enough samples, use all
            total_budget -= count
        else:
            # we have enough transactions in current the class
            # we want to only keep budget_per_transactions
            transaction_rate = budget_per_transaction_type / count
            ret_val[name] = transaction_rate
            total_budget -= budget_per_transaction_type
    return ret_val


_SampleRates = namedtuple("_SampleRates", "min_sample_size, explicit_rates, global_rate")


def adjust_sample_rate_max(
    transactions: List[Tuple[str, int]], rate: float, max_explicit_transactions: int
) -> _SampleRates:
    """
    Calculates explicit rates for the transactions with the biggest number of elements and
    with the remaining space created adjusts the sampling rate for the rest
    """
    transactions = copy(transactions)
    num_transactions, num_types, total_budget, budget_per_transaction_type = _sampling_info(
        transactions, rate
    )
    # first see if we can get sample rate 1 for all small transactions if that's the case then it is
    # the optimal solution
    small_transactions = transactions[0 : num_types - max_explicit_transactions]
    count_small_transactions = total_transactions(small_transactions)
    transaction_dict: MutableMapping[str, float] = {}
    if count_small_transactions < budget_per_transaction_type * len(small_transactions):
        # we can set all small transactions to rate 1 and then adjust large transactions
        budget_all_big_transactions = total_budget - count_small_transactions
        big_transactions = transactions[-max_explicit_transactions:]
        num_big_transactions = total_transactions(big_transactions)
        # calculate the new rate for big transaction and treat them as a full resample
        new_rate = budget_all_big_transactions / num_big_transactions
        transaction_dict = adjust_sample_rate_full(big_transactions, new_rate)
        # since all small transactions are sampled at 1 the min_sample_size can be found
        # in any big transaction that is not sampled at 1 (since they all will have the
        # same size
        for name, count in big_transactions:
            rate = transaction_dict[name]
            if rate != 1.0:
                min_sample_size = count * rate
                return _SampleRates(min_sample_size, transaction_dict, 1)
        # if we are here we are sampling at 1.0 (a bit silly but no reason to crash)
        return _SampleRates(budget_per_transaction_type, transaction_dict, 1)
    else:
        # push all big transactions at the ideal sample size
        for _ in range(max_explicit_transactions):
            name, count = transactions.pop(-1)
            transaction_rate = budget_per_transaction_type / count
            transaction_dict[name] = transaction_rate
            total_budget -= budget_per_transaction_type
        global_rate = total_budget / total_transactions(transactions)
        # min sample size would be for the first transaction
        min_sample_size = transactions[0][1] * global_rate
        return _SampleRates(min_sample_size, transaction_dict, global_rate)


def adjust_sample_rate_min(
    transactions: List[Tuple[str, int]], rate: float, max_explicit_transactions: int
) -> _SampleRates:
    transactions = copy(transactions)
    num_transactions, num_types, total_budget, budget_per_transaction_type = _sampling_info(
        transactions, rate
    )

    transactions_dict = {}
    # push all small transactions at either rate=1 or ideal sample size
    for idx in range(max_explicit_transactions):
        name, count = transactions.pop(0)
        if count < budget_per_transaction_type:
            transactions_dict[name] = 1.0
            total_budget -= count
        else:
            transactions_dict[name] = budget_per_transaction_type / count
            total_budget -= budget_per_transaction_type
        num_types = len(transactions)
        budget_per_transaction_type = total_budget / num_types
    # calculate rate for all other transactions
    global_rate = total_budget / total_transactions(transactions)
    min_sample_size = global_rate * transactions[0][1]
    return _SampleRates(min_sample_size, transactions_dict, global_rate)


def _sampling_info(
    transactions: List[Tuple[str, int]], rate: float
) -> Tuple[int, int, float, float]:
    num_types = len(transactions)
    num_transactions = total_transactions(transactions)
    total_budget = num_transactions * rate
    budget_per_transaction_type = total_budget / num_types
    return num_transactions, num_types, total_budget, budget_per_transaction_type


def total_transactions(transactions: List[Tuple[str, int]]) -> int:
    ret_val = 0
    for _, v in transactions:
        ret_val += v
    return ret_val


def get_num_sampled_transactions(
    transactions: List[Tuple[str, int]], trans_dict: Mapping[str, float], global_rate: float
) -> float:
    num_transactions = 0.0
    for name, count in transactions:
        transaction_rate = trans_dict.get(name)
        if transaction_rate:
            num_transactions += transaction_rate * count
        else:
            num_transactions += global_rate * count
    return num_transactions
