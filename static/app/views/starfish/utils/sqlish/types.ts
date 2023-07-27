export interface Token {
  type: 'Keyword' | 'Parameter' | 'CollapsedColumns' | 'Whitespace' | 'GenericToken';
  content?: string | Token | Token[];
}
