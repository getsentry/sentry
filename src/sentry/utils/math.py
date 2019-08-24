from __future__ import absolute_import, division

import math


def mean(values):
    return sum(values) / len(values)


def stddev(values, mean_=None):
    if mean_ is None:
        mean_ = mean(values)

    n = 0
    for val in values:
        n += (val - mean_) ** 2
    n = math.sqrt(n / float(len(values) - 1))
    return n


def median(values):
    values = sorted(values)
    size = len(values)
    if size % 2 == 1:
        return values[int((size - 1) / 2)]
    return (values[int(size / 2 - 1)] + values[int(size / 2)]) / 2


def mad(values, K=1.4826):
    # http://en.wikipedia.org/wiki/Median_absolute_deviation
    med = median(values)
    return K * median([abs(val - med) for val in values])
