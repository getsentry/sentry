export enum QueryInterfaceType {
  TEXT = 'text',
  TOKENIZED = 'tokenized',
}

export type FocusOverride = {
  itemKey: string;
  part?: 'value';
};
