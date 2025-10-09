import type {
  AskSeerSearchItems,
  NoneOfTheseItem,
  QueryTokensProps,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';

export function isNoneOfTheseItem(
  item: AskSeerSearchItems<any>
): item is NoneOfTheseItem {
  return item.key === 'none-of-these';
}

function formatToken(token: string): string {
  const isNegated = token.startsWith('!') && token.includes(':');
  const actualToken = isNegated ? token.slice(1) : token;

  const operators = [
    [':>=', 'greater than or equal to'],
    [':<=', 'less than or equal to'],
    [':!=', 'not'],
    [':>', 'greater than'],
    [':<', 'less than'],
    ['>=', 'greater than or equal to'],
    ['<=', 'less than or equal to'],
    ['!=', 'not'],
    ['!:', 'not'],
    ['>', 'greater than'],
    ['<', 'less than'],
    [':', ''],
  ] as const;

  for (const [op, desc] of operators) {
    if (actualToken.includes(op)) {
      const [key, value] = actualToken.split(op);
      const cleanKey = key?.trim() || '';
      const cleanVal = value?.trim() || '';

      const negation = isNegated ? 'not ' : '';
      const description = desc ? `${negation}${desc}` : negation ? 'not' : '';

      return `${cleanKey} is ${description} ${cleanVal}`.replace(/\s+/g, ' ').trim();
    }
  }

  return token;
}

export function formatQueryToNaturalLanguage(query: string): string {
  if (!query.trim()) return '';
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const formattedTokens = tokens.map(formatToken);

  const formattedQuery = formattedTokens.reduce((result, token, index) => {
    if (index === 0) return token;

    const currentOriginalToken = tokens[index] || '';
    const prevOriginalToken = tokens[index - 1] || '';

    const isLogicalOp = token.toUpperCase() === 'AND' || token.toUpperCase() === 'OR';
    const prevIsLogicalOp =
      formattedTokens[index - 1]?.toUpperCase() === 'AND' ||
      formattedTokens[index - 1]?.toUpperCase() === 'OR';

    if (isLogicalOp || prevIsLogicalOp) {
      return `${result} ${token}`;
    }

    const isCurrentFilter = /[:>=<!]/.test(currentOriginalToken);
    const isPrevFilter = /[:>=<!]/.test(prevOriginalToken);

    if (isCurrentFilter && isPrevFilter) {
      return `${result}, ${token}`;
    }

    return `${result} ${token}`;
  }, '');

  // add a space at the end of the query to give space for the cursor
  return `${formattedQuery} `;
}

export function generateQueryTokensString(args: QueryTokensProps): string {
  const parts = [];

  if (args?.query) {
    const formattedFilter = formatQueryToNaturalLanguage(args.query.trim());
    parts.push(`Filter is '${formattedFilter}'`);
  }

  if (args?.visualizations && args.visualizations.length > 0) {
    const vizParts = args.visualizations.flatMap(visualization =>
      visualization.yAxes.map(yAxis => yAxis)
    );
    if (vizParts.length > 0) {
      const vizText = vizParts.length === 1 ? vizParts[0] : vizParts.join(', ');
      parts.push(`visualizations are '${vizText}'`);
    }
  }

  if (args?.groupBys && args.groupBys.length > 0) {
    const groupByText =
      args.groupBys.length === 1 ? args.groupBys[0] : args.groupBys.join(', ');
    parts.push(`groupBys are '${groupByText}'`);
  }

  if (args?.statsPeriod && args.statsPeriod.length > 0) {
    parts.push(`time range is '${args?.statsPeriod}'`);
  }

  if (args?.sort && args.sort.length > 0) {
    const sortText =
      args?.sort[0] === '-' ? `${args?.sort.slice(1)} Desc` : `${args?.sort} Asc`;
    parts.push(`sort is '${sortText}'`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No query parameters set';
}
