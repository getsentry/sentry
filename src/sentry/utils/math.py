import math
from abc import ABC, abstractmethod


def mean(values):
    return sum(values) / len(values)


def median(values):
    values = sorted(values)
    size = len(values)
    if size % 2 == 1:
        return values[int((size - 1) / 2)]
    return (values[int(size / 2 - 1)] + values[int(size / 2)]) / 2


def nice_int(x):
    """
    Round away from zero to the nearest "nice" number.
    """

    if x == 0:
        return 0

    sign = 1 if x > 0 else -1
    x = abs(x)

    if x < 10:
        rounded = 1
        steps = [1, 2, 5, 10]
    elif x < 100:
        rounded = 1
        steps = [10, 20, 25, 50, 100]
    else:
        exp = int(math.log10(x))
        rounded = 10 ** (exp - 2)
        steps = [100, 120, 200, 250, 500, 750, 1000]

    nice_frac = steps[-1]
    frac = x / rounded
    for step in steps:
        if frac <= step:
            nice_frac = step
            break

    return sign * nice_frac * rounded


class MovingAverage(ABC):
    def __init__(self):
        self.value: float = 0
        self.n: int = 0

    def set(self, value: float, n: int) -> None:
        self.value = value
        self.n = n

    def update(self, x: float) -> None:
        if self.n == 0:
            self.value = x
        else:
            weight = self.get_weight(self.n + 1)
            self.value = x * weight + self.value * (1 - weight)
        self.n += 1

    @abstractmethod
    def get_weight(self, n: int) -> float:
        raise NotImplementedError


class SimpleMovingAverage(MovingAverage):
    def get_weight(self, n: int) -> float:
        return 1 / n


class ExponentialMovingAverage(MovingAverage):
    def __init__(self, weight: float):
        super().__init__()
        assert weight < 1
        self.weight = weight

    def get_weight(self, n: int) -> float:
        return self.weight
