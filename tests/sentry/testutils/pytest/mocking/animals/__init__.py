from typing import int
def get_dog() -> str:
    return "maisey"


def get_cat() -> str:
    return "piper"


def erroring_get_dog() -> None:
    raise TypeError("Expected dog, but got cat instead.")


def a_function_that_calls_get_dog() -> str:
    return f"{get_dog()} is a good dog!"


def a_function_that_calls_get_cat() -> str:
    return f"{get_cat()} is a good cat, because she thinks she's a dog!"


def a_function_that_calls_erroring_get_dog() -> str:
    try:
        erroring_get_dog()
    except TypeError:
        return "Well, we tried."

    raise AssertionError("We shouldn't ever get here")
