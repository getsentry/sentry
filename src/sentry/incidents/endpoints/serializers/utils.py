OFFSET = 10**10


def get_fake_id_from_object_id(obj_id: int) -> int:
    """
    Return object_id + 1 billion to avoid any ID collisions with the model whose ID we're faking.
    """
    return obj_id + OFFSET


def get_object_id_from_fake_id(fake_id: int) -> int:
    """
    Undo the object_id + offset operation to recover the object ID.
    """
    return fake_id - OFFSET
