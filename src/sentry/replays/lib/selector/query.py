from typing import List, Union

from snuba_sdk import Column, Function, Identifier, Lambda


def union_find(arrs: List[Column], values: List[Union[str, List[str]]]) -> Function:
    """Return a row if a union can be formed out of the sets.

    Accepts as input:
        (arrs=[[a, b, c], [d, e, c]], values=[a, c])

    Values and arrays are zipped:
        [(a, [a, b, c]), (c, [c, c, d])]

    A bitmask is applied:
        [[1, 0, 0], [1, 1, 0]]

    The results are zipped into like tuples:
        [(1, 1), (0, 1), (0, 0)]

    Tuples are filtered for exact matches:
        [(1, 1)]

    If the array is not empty a truthy value is returned:
        1
    """
    if len(arrs) == 0 and len(values) == 0:
        raise ValueError("Must filter against more than one column.")
    elif len(arrs) != len(values):
        # Programmer error.
        raise ValueError("Mismatched number of arrays and values.")

    return Function(
        "notEmpty",
        parameters=[
            Function(
                "arrayFilter",
                parameters=[
                    Lambda(
                        ["tuple"],
                        Function("equals", parameters=[Identifier("tuple"), (1,) * len(arrs)]),
                    ),
                    Function(
                        "arrayZip",
                        parameters=[
                            _map_bitmask_operation(arr, value) for arr, value in zip(arrs, values)
                        ],
                    ),
                ],
            )
        ],
    )


def _map_bitmask_operation(arr: Column, value: Union[str, List[str]]) -> Function:
    """List type values require special handling.

    This is only applicable to the class array.
    """
    if isinstance(value, list):
        return _apply_array_bitmask(arr, value)
    else:
        return _apply_scalar_bitmask(arr, value)


def _apply_array_bitmask(arr: Column, subset: List[str]) -> Function:
    """Return `1` for the index position if the subset is contained within the set.

    Accepts as input:
        [[1], [2], [2, 3]], [2, 3]

    Returns as output:
        [0, 0, 1]
    """
    map_fn = Lambda(["set"], Function("hasAll", parameters=[Identifier("set"), subset]))
    return Function("arrayMap", parameters=[map_fn, arr])


def _apply_scalar_bitmask(arr: Column, value: str) -> Function:
    """Return `1` for the index position if the value matches the scalar at that position.

    Accepts as input:
        [1, 2, 3], 3

    Returns as output:
        [0, 0, 1]
    """
    map_fn = Lambda(["item"], Function("equals", parameters=[Identifier("item"), value]))
    return Function("arrayMap", parameters=[map_fn, arr])
