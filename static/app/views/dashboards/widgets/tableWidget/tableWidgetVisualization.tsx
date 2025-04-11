type TableWidgetVisualizationProps<T> = {
  columns: Array<TableWidgetColumn<T>>;
  data: T[];
};

type TableWidgetColumn<T> = {
  key: keyof T;
  name: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
};
