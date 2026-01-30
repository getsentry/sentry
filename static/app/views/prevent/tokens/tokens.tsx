import {useCallback} from 'react';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {IntegratedOrgSelector} from 'sentry/components/prevent/integratedOrgSelector/integratedOrgSelector';
import {integratedOrgIdToName} from 'sentry/components/prevent/utils';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useGetActiveIntegratedOrgs} from 'sentry/views/prevent/tests/queries/useGetActiveIntegratedOrgs';

import {useInfiniteRepositoryTokens} from './repoTokenTable/hooks/useInfiniteRepositoryTokens';
import RepoTokenTable, {parseSortFromQuery} from './repoTokenTable/repoTokenTable';

export default function TokensPage() {
  const {integratedOrgId} = usePreventContext();
  const organization = useOrganization();
  const navigate = useNavigate();
  const {data: integrations = []} = useGetActiveIntegratedOrgs({organization});
  const location = useLocation();

  const sort = parseSortFromQuery(location.query?.sort as string);

  const response = useInfiniteRepositoryTokens({
    cursor: location.query?.cursor as string | undefined,
    navigation: location.query?.navigation as 'next' | 'prev' | undefined,
    sort,
  });

  const handleCursor = useCallback(
    (delta: number) => {
      // Without these guards, the pagination cursor can get stuck on an incorrect value.
      const navigation = delta === -1 ? 'prev' : 'next';
      const goPrevPage = navigation === 'prev' && response.hasPreviousPage;
      const goNextPage = navigation === 'next' && response.hasNextPage;

      if (
        (navigation === 'next' && !response.hasNextPage) ||
        (navigation === 'prev' && !response.hasPreviousPage)
      ) {
        return;
      }

      navigate({
        query: {
          ...location.query,
          cursor: goPrevPage
            ? response.startCursor
            : goNextPage
              ? response.endCursor
              : undefined,
          navigation,
        },
      });
    },
    [navigate, response, location.query]
  );
  const integratedOrgName = integratedOrgIdToName(integratedOrgId, integrations);

  return (
    <Flex direction="column" gap="xl" maxWidth="1000px">
      <IntegratedOrgSelector />
      <Heading as="h2" size="2xl">
        {t('Repository tokens')}
      </Heading>
      <Text>
        {tct(
          `View the list of tokens created for your repositories in [org]. Use them for uploading reports to all Sentry Prevent's features.`,
          {
            org: integratedOrgName ? (
              <Text bold>{integratedOrgName}</Text>
            ) : (
              <Text>{t('your organization')}</Text>
            ),
          }
        )}
      </Text>
      <RepoTokenTable response={response} sort={sort} />
      <Flex justify="right">
        <ButtonBar merged gap="0">
          <Button
            icon={<IconChevron direction="left" />}
            aria-label={t('Previous')}
            size="sm"
            disabled={!response.hasPreviousPage}
            onClick={() => handleCursor(-1)}
          />
          <Button
            icon={<IconChevron direction="right" />}
            aria-label={t('Next')}
            size="sm"
            disabled={!response.hasNextPage}
            onClick={() => handleCursor(1)}
          />
        </ButtonBar>
      </Flex>
    </Flex>
  );
}
