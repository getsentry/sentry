from django.dispatch import Signal

process_cell_outbox = Signal()  # ["payload", "object_identifier"]
process_control_outbox = Signal()  # ["payload", "region_name", "object_identifier"]


# TODO(cells): Remove alias once getsentry is updated
process_region_outbox = process_cell_outbox
