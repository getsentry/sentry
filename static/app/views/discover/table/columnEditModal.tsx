import {Fragment, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ExternalLink from 'sentry/components/links/externalLink';
import {DISCOVER2_DOCS_URL} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {
  type Column,
  ERROR_FIELDS,
  ERRORS_AGGREGATION_FUNCTIONS,
  getAggregations,
  TRANSACTION_FIELDS,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {AggregationKey, FieldKey} from 'sentry/utils/fields';
import theme from 'sentry/utils/theme';
import useTags from 'sentry/utils/useTags';
import {generateFieldOptions} from 'sentry/views/discover/utils';

import ColumnEditCollection from './columnEditCollection';

type Props = {
  columns: Column[];
  measurementKeys: null | string[];
  // Fired when column selections have been applied.
  onApply: (columns: Column[]) => void;
  organization: Organization;
  customMeasurements?: CustomMeasurementCollection;
  dataset?: DiscoverDatasets;
  spanOperationBreakdownKeys?: string[];
} & ModalRenderProps;

function ColumnEditModal(props: Props) {
  const {
    Header,
    Body,
    Footer,
    measurementKeys,
    spanOperationBreakdownKeys,
    organization,
    onApply,
    closeModal,
    customMeasurements,
    dataset,
  } = props;

  // Only run once for each organization.id.
  useEffect(() => {
    trackAnalytics('discover_v2.column_editor.open', {organization});
  }, [organization]);

  const tags = useTags();
  const tagKeys = Object.keys(tags);

  const [columns, setColumns] = useState<Column[]>(props.columns);

  function handleApply() {
    onApply(columns);
    closeModal();
  }

  let fieldOptions: ReturnType<typeof generateFieldOptions>;

  if (dataset === DiscoverDatasets.ERRORS) {
    const aggregations = getAggregations(DiscoverDatasets.ERRORS);
    fieldOptions = generateFieldOptions({
      organization,
      tagKeys,
      fieldKeys: ERROR_FIELDS,
      aggregations: Object.keys(aggregations)
        .filter(key => ERRORS_AGGREGATION_FUNCTIONS.includes(key as AggregationKey))
        .reduce((obj, key) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          obj[key] = aggregations[key];
          return obj;
        }, {}),
    });
  } else if (dataset === DiscoverDatasets.TRANSACTIONS) {
    fieldOptions = generateFieldOptions({
      organization,
      tagKeys,
      measurementKeys,
      spanOperationBreakdownKeys,
      customMeasurements: Object.values(customMeasurements ?? {}).map(
        ({key, functions}) => ({
          key,
          functions,
        })
      ),
      fieldKeys: TRANSACTION_FIELDS,
    });
  } else {
    fieldOptions = generateFieldOptions({
      organization,
      tagKeys,
      measurementKeys,
      spanOperationBreakdownKeys,
      customMeasurements: Object.values(customMeasurements ?? {}).map(
        ({key, functions}) => ({
          key,
          functions,
        })
      ),
    });
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Edit Columns')}</h4>
      </Header>
      <Body>
        <Instruction>
          {tct(
            'To group events, add [functionLink: functions] f(x) that may take in additional parameters. [fieldTagLink: Tag and field] columns will help you view more details about the events (i.e. title).',
            {
              functionLink: (
                <ExternalLink href="https://docs.sentry.io/product/discover-queries/query-builder/#filter-by-table-columns" />
              ),
              fieldTagLink: (
                <ExternalLink href="https://docs.sentry.io/product/sentry-basics/search/searchable-properties/#event-properties" />
              ),
            }
          )}
        </Instruction>
        <ColumnEditCollection
          columns={columns}
          fieldOptions={fieldOptions}
          filterAggregateParameters={option =>
            option.value.meta.name !== FieldKey.TOTAL_COUNT
          }
          // Performance Score is not supported in Discover because
          // INP is not stored on sampled transactions.
          filterPrimaryOptions={option =>
            option.value.meta.name !== AggregationKey.PERFORMANCE_SCORE
          }
          onChange={setColumns}
          organization={organization}
          supportsEquations
        />
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <LinkButton priority="default" href={DISCOVER2_DOCS_URL} external>
            {t('Read the Docs')}
          </LinkButton>
          <Button aria-label={t('Apply')} priority="primary" onClick={handleApply}>
            {t('Apply')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

const Instruction = styled('div')`
  margin-bottom: ${space(4)};
`;

const modalCss = css`
  @media (min-width: ${theme.breakpoints.medium}) {
    width: auto;
    max-width: 900px;
  }
`;

export default ColumnEditModal;
export {modalCss};
