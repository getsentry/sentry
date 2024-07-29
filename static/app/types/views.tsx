export type View = {
  name: string;
  query: string;
  querySort: 'date' | 'new' | 'trend' | 'freq' | 'user' | 'inbox';
  id?: string;
};
