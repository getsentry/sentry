from sentry.utils import get_db_engine

def has_charts(db):
    engine = get_db_engine(db)
    if engine.startswith('sqlite'):
        return False
    return True