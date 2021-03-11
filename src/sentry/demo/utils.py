import petname


class NoDemoOrgReady(Exception):
    pass


def generate_random_name() -> str:
    return petname.Generate(2, " ", letters=10).title()
