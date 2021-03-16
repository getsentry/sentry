from sentry.similarity import text_shingle


def text_shingle_encoder(n):
    label = f"character-{n}-shingle"

    def inner(id, value):
        yield (id, label), text_shingle(n, value)

    return inner


def ident_encoder(id, value):
    yield (id, "ident-shingle"), [value]
