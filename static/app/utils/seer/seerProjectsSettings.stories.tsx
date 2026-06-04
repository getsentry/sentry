import {useState} from 'react';
import styled from '@emotion/styled';
import {infiniteQueryOptions, useInfiniteQuery} from '@tanstack/react-query';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PreferredAgentLabel} from 'sentry/components/seer/preferredAgent';
import {StoppingPointLabel} from 'sentry/components/seer/stoppingPoint';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  ListItemCheckboxProvider,
  useListItemCheckboxContext,
} from 'sentry/utils/list/useListItemCheckboxState';
import {getInfiniteSeerProjectsSettingsQueryOptions} from 'sentry/utils/seer/seerProjectsSettings';
import {getUserFacingStoppingPoint} from 'sentry/utils/seer/stoppingPoint';
import {useOrganization} from 'sentry/utils/useOrganization';

export default Storybook.story('SeerProjectsSettings', story => {
  story('Autofix Projects Settings', () => {
    const [showFormatted, setShowFormatted] = useState(false);

    const organization = useOrganization();

    const result = useInfiniteQuery(
      infiniteQueryOptions({
        ...getInfiniteSeerProjectsSettingsQueryOptions({
          organization,
          query: {per_page: 25},
        }),
        select: ({pages}) =>
          pages.flatMap(page => page.json.filter(item => item.reposCount > 0)),
      })
    );
    useFetchAllPages({result});

    const {data, isPending, isError, error, isFetchingNextPage} = result;

    if (isPending) {
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
      <ListItemCheckboxProvider
        hits={data.length}
        knownIds={data.map(item => item.projectId)}
        endpointOptions={{
          query: {},
        }}
      >
        <Stack gap="xl">
          <Flex as="label" gap="md" htmlFor="showFormatted">
            <Text>{t('Format Column Values')}</Text>
            <Checkbox
              id="showFormatted"
              checked={showFormatted}
              onChange={() => setShowFormatted(!showFormatted)}
            />
          </Flex>
          <SimpleTable
            style={{gridTemplateColumns: 'max-content 2fr max-content repeat(2, 1fr)'}}
          >
            <SimpleTable.Header>
              <SimpleTable.HeaderCell />
              <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Repos')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Agent')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Stopping Point')}</SimpleTable.HeaderCell>
            </SimpleTable.Header>
            {data.length === 0 ? (
              <SimpleTable.Empty>{t('No projects found')}</SimpleTable.Empty>
            ) : (
              data.map(item => (
                <SimpleTable.Row key={item.projectId}>
                  <SimpleTable.RowCell>
                    <RowSelectCheckbox
                      htmlPrefix="seer-project-settings"
                      value={item.projectSlug}
                    />
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <Text bold>{item.projectSlug}</Text>
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <Text>{item.reposCount}</Text>
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <Text>
                      {showFormatted ? (
                        <PreferredAgentLabel settings={item} />
                      ) : (
                        item.agent
                      )}
                    </Text>
                  </SimpleTable.RowCell>

                  <SimpleTable.RowCell>
                    <Text>
                      {showFormatted ? (
                        <StoppingPointLabel
                          stoppingPoint={getUserFacingStoppingPoint(item.stoppingPoint)}
                        />
                      ) : (
                        item.stoppingPoint
                      )}
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
        </Stack>
      </ListItemCheckboxProvider>
    );
  });
});

const CheckboxClickTarget = styled('label')`
  cursor: pointer;
  display: block;
  margin: -${p => p.theme.space.md};
  padding: ${p => p.theme.space.md};
  max-width: unset;
  line-height: 0;
`;

function RowSelectCheckbox({htmlPrefix, value}: {htmlPrefix: string; value: string}) {
  const {isSelected, toggleSelected} = useListItemCheckboxContext();
  const htmlId = `${htmlPrefix}-${value}`;
  return (
    <CheckboxClickTarget htmlFor={htmlId}>
      <Checkbox
        id={htmlId}
        disabled={isSelected(value) === 'all-selected'}
        checked={isSelected(value) !== false}
        onChange={() => toggleSelected(value)}
      />
    </CheckboxClickTarget>
  );
}
