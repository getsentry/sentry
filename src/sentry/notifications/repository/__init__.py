"""
The repository classes are responsible for the interactions with the data store for the NotificationMessage data model.
The classes help separate the query interface with the actual data store for the NotificationMessage data model.

If we scale quickly, the current NotificationMessage data model will have to shift from django postgres to
snuba clickhouse, and these classes will help keep the changes consolidated to here.

What we query from an interface level won't change, simply how we query will change, and these classes should be the
only thing that need to change after we make the migration.
"""
