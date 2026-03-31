from django.dispatch import Signal

process_cell_outbox = Signal()  # ["payload", "object_identifier"]
process_control_outbox = Signal()  # ["payload", "cell_name", "object_identifier"]
