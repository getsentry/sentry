export type Crumb = {
  data: Data;
  message?: string;
  type: string;
  category?: string;
};

type Data = {
  type?: string;
  value?: string;
  method?: string;
  status_code?: number | string;
  url?: any;
};
