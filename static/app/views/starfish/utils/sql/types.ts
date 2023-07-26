export interface Token {
  type:
    | 'Keyword'
    | 'Parameter'
    | 'CollapsedColumns'
    | 'Semicolon'
    | 'Whitespace'
    | 'GenericToken';
  content?: string | Token | Token[];
}
