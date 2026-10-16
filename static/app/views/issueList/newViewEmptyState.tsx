import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Stack} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

type SearchSuggestion = {
  label: string;
  query: string;
};

const RECOMMENDED_SEARCHES: SearchSuggestion[] = [
  {label: t('Prioritized'), query: 'is:unresolved issue.priority:[high, medium]'},
  {label: t('Assigned to Me'), query: 'is:unresolved assigned_or_suggested:me'},
  {
    label: t('For Review'),
    query: 'is:unresolved is:for_review assigned_or_suggested:[me, my_teams, none]',
  },
  {label: t('Request Errors'), query: 'is:unresolved http.status_code:5*'},
  {label: t('High Volume Issues'), query: 'is:unresolved timesSeen:>100'},
  {label: t('Recent Errors'), query: 'is:unresolved issue.category:error firstSeen:-24h'},
  {label: t('Function Regressions'), query: 'issue.type:profile_function_regression'},
];

function Query({label, query}: SearchSuggestion) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const setQuery = () => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        query,
      },
    });

    trackAnalytics('issue_views.new_view.suggested_query_clicked', {
      query,
      query_label: label,
      organization,
    });
  };

  return (
    <QueryRow>
      <QueryButton onClick={setQuery}>
        <InteractionStateLayer />
        <div>{label}</div>
        <div>
          <FormattedQuery query={query} />
        </div>
      </QueryButton>
    </QueryRow>
  );
}

export function NewViewEmptyState() {
  return (
    <Stack justify="center" align="center" marginTop="3xl">
      <Card>
        <CardHeading>{t('Suggested Queries')}</CardHeading>
        <p>{t('Here are a few to get you started.')}</p>
        <QueryGrid>
          {RECOMMENDED_SEARCHES.map(query => (
            <Query key={query.query} {...query} />
          ))}
        </QueryGrid>
      </Card>
    </Stack>
  );
}

const Card = styled(Panel)`
  width: 80%;
  background-color: ${p => p.theme.tokens.background.secondary};
  padding: ${p => p.theme.space.xl};
`;

const CardHeading = styled('h2')`
  font-size: ${p => p.theme.font.size.xl};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: ${p => p.theme.space.md};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const QueryGrid = styled('ul')`
  display: grid;
  grid-template-columns: 1fr 4fr;
  column-gap: ${p => p.theme.space.xl};
  margin: 0 -${p => p.theme.space.xl};
  padding: 0;
`;

const QueryRow = styled('li')`
  position: relative;
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1/-1;
  list-style: none;
  overflow: hidden;

  &:not(:last-child) {
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
    }
  }
`;

const QueryButton = styled('button')`
  position: relative;
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1/-1;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  background: none;
  border: none;
  margin: 0;
  width: 100%;
  text-align: left;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  border-radius: 0;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px ${p => p.theme.tokens.focus.default};
  }
`;

const FormattedQuery = styled(ProvidedFormattedQuery)`
  position: relative;
`;
