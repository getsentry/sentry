import {Fragment} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import uniqBy from 'lodash/uniqBy';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PreferredAgentLabel} from 'sentry/components/seer/preferredAgent';
import {StoppingPointLabel} from 'sentry/components/seer/stoppingPoint';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {getInfiniteSeerProjectsSettingsQueryOptions} from 'sentry/utils/seer/seerProjectsSettings';
import {getUserFacingStoppingPoint} from 'sentry/utils/seer/stoppingPoint';
import {useOrganization} from 'sentry/utils/useOrganization';

export default Storybook.story('SeerProjectsSettings', story => {
  story('Autofix Projects Settings', () => {
    const organization = useOrganization();

    const result = useInfiniteQuery(
      getInfiniteSeerProjectsSettingsQueryOptions({
        organization,
        query: {per_page: 25},
      })
    );
    useFetchAllPages({result});

    const {data, isLoading, isError, error, isFetchingNextPage} = result;

    const items = uniqBy(
      (data?.pages ?? []).flatMap(page => page.json),
      'projectId'
    );

    if (isLoading) {
      return (
        <Flex justify="center" padding="xl">
          <LoadingIndicator />
        </Flex>
      );
    }

    if (isError) {
      return (
        <Flex justify="center" padding="xl">
          <Text variant="muted">{t('Error: %s', error.message)}</Text>
        </Flex>
      );
    }

    return (
      <Fragment>
        <SimpleTable style={{gridTemplateColumns: '2fr max-content repeat(4, 1fr)'}}>
          <SimpleTable.Header>
            <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Repos')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Agent')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Agent (fmt)')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Stopping Point')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Stopping Point (fmt)')}</SimpleTable.HeaderCell>
          </SimpleTable.Header>
          {items.length === 0 ? (
            <SimpleTable.Empty>{t('No projects found')}</SimpleTable.Empty>
          ) : (
            items.map(item => (
              <SimpleTable.Row key={item.projectId}>
                <SimpleTable.RowCell>
                  <Text bold>{item.projectSlug}</Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text>{item.reposCount}</Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text>{item.agent}</Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text>
                    <PreferredAgentLabel settings={item} />
                  </Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text>{item.stoppingPoint}</Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text>
                    <StoppingPointLabel
                      stoppingPoint={getUserFacingStoppingPoint(item.stoppingPoint)}
                    />
                  </Text>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))
          )}
        </SimpleTable>
        {isFetchingNextPage ? (
          <Flex justify="center" padding="md">
            <LoadingIndicator mini />
          </Flex>
        ) : null}
      </Fragment>
    );
  });
});
