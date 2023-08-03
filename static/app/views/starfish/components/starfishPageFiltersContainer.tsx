import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';

type Props = {
  children: React.ReactNode;
};

export function StarfishPageFiltersContainer({children}: Props) {
  return (
    <PageFiltersContainer isStarfishPage skipLoadLastUsedEnvironment>
      {children}
    </PageFiltersContainer>
  );
}
