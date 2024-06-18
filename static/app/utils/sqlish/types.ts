export interface Token {
  type:
    | 'LeftParenthesis'
    | 'RightParenthesis'
    | 'Whitespace'
    | 'Keyword'
    | 'Parameter'
    | 'CollapsedColumns'
    | 'GenericToken';
  content?: string | Token | Token[];
}
