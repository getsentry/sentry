type TableWidgetVisualizationProps<T> = {
  data: T[];
  columns: TableWidgetColumn<T>[];
};

type TableWidgetColumn<T> = {
  key: keyof T;
  name: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
};
