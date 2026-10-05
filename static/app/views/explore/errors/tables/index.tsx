import {Fragment, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {AggregatesTable} from 'sentry/views/explore/errors/tables/aggregatesTable';
import {ErrorsTable} from 'sentry/views/explore/errors/tables/errorsTable';

enum Tab {
  ERROR = 'error',
  AGGREGATE = 'aggregate',
  ATTRIBUTE_BREAKDOWNS = 'attribute_breakdowns',
}

export function ErrorsTables() {
  const [tab, setTab] = useState<Tab>(Tab.ERROR);

  // TODO: make column editor modals
  const openColumnEditor = () => {};

  return (
    <Fragment>
      <Flex justify="between" marginBottom="md" gap="md" wrap="wrap">
        <Tabs value={tab} onChange={setTab} size="sm">
          <TabList variant="floating">
            <TabList.Item key={Tab.ERROR}>{t('Errors')}</TabList.Item>
            <TabList.Item key={Tab.AGGREGATE}>{t('Aggregates')}</TabList.Item>
            <TabList.Item
              key={Tab.ATTRIBUTE_BREAKDOWNS}
              textValue={t('Attribute Breakdowns')}
            >
              {t('Attribute Breakdowns')}
            </TabList.Item>
          </TabList>
        </Tabs>
        {tab === Tab.ERROR || tab === Tab.AGGREGATE ? (
          <Button onClick={openColumnEditor} icon={<IconEdit />} size="sm">
            {t('Edit Table')}
          </Button>
        ) : (
          <Tooltip
            title={t('Use the Group By and Visualize controls to change table columns')}
          >
            <Button disabled onClick={openColumnEditor} icon={<IconEdit />} size="sm">
              {t('Edit Table')}
            </Button>
          </Tooltip>
        )}
      </Flex>
      {tab === Tab.ERROR && <ErrorsTable />}
      {tab === Tab.AGGREGATE && <AggregatesTable />}
      {tab === Tab.ATTRIBUTE_BREAKDOWNS && (
        <Container height="200px" border="primary" radius="md" padding="md" />
      )}
    </Fragment>
  );
}
