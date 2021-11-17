// TODO: Widget sizes should be enum instead of literal strings
const DEFAULT_SIZE = 'small';

export const assignWidgetSize = widget => {
  const size = widget.displayType === 'big_number' ? 'medium' : DEFAULT_SIZE;
  return {...widget, size};
};
