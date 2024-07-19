from django.db.models.indexes import Index


class IndexWithPostgresNameLimits(Index):
    max_name_length = 63
