import {Actions} from 'sentry/views/discover/table/cellAction';

export const ALLOWED_CELL_ACTIONS: Actions[] = [
  Actions.ADD,
  Actions.EXCLUDE,
  Actions.SHOW_GREATER_THAN,
  Actions.SHOW_LESS_THAN,
  Actions.COPY_TO_CLIPBOARD,
  Actions.OPEN_EXTERNAL_LINK,
  Actions.OPEN_INTERNAL_LINK,
];
