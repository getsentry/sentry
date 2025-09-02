import {
  DEFAULT_SPAN_OP_SELECTION,
  PAGE_SPAN_OPS,
  type PageSpanOps,
} from 'sentry/views/insights/pages/frontend/settings';

const isPageSpanOp = (op?: string): op is PageSpanOps => {
  return PAGE_SPAN_OPS.includes(op as PageSpanOps);
};

export const getSpanOpFromQuery = (op?: string): PageSpanOps => {
  if (isPageSpanOp(op)) {
    return op;
  }
  return DEFAULT_SPAN_OP_SELECTION;
};
