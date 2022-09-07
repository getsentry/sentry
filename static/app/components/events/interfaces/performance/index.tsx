import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, Group, KeyValueListData, Organization} from 'sentry/types';

import KeyValueList from '../keyValueList';
import {EmbeddedSpanTree} from '../spans/embeddedSpanTree';

export type SpanEvidence = {
  parentSpan: string;
  repeatingSpan: string;
  sourceSpan: string;
  transaction: string;
};

interface Props {
  affectedSpanIds: string[];
  event: Event;
  issue: Group;
  organization: Organization;
  projectSlug: string;
  spanEvidence: SpanEvidence;
}

export function SpanEvidenceSection({
  spanEvidence,
  event,
  organization,
  projectSlug,
  affectedSpanIds,
}: Props) {
  const {transaction, parentSpan, sourceSpan, repeatingSpan} = spanEvidence;

  const data: KeyValueListData = [
    {
      key: '0',
      subject: t('Transaction'),
      value: transaction,
    },
    {
      key: '1',
      subject: t('Parent Span'),
      value: parentSpan,
    },
    {
      key: '2',
      subject: t('Source Span'),
      value: sourceSpan,
    },
    {
      key: '3',
      subject: t('Repeating Span'),
      value: repeatingSpan,
    },
  ];

  return (
    <Wrapper>
      <h3>{t('Span Evidence')}</h3>
      <KeyValueList data={data} />
      <EmbeddedSpanTree
        event={event}
        organization={organization as Organization}
        projectSlug={projectSlug}
        affectedSpanIds={affectedSpanIds}
      />
    </Wrapper>
  );
}

export const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: 0;
  /* Padding aligns with Layout.Body */
  padding: ${space(3)} ${space(2)} ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(3)} ${space(4)} ${space(3)};
  }
  & h3,
  & h3 a {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    color: ${p => p.theme.gray300};
  }
  & h3 {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    padding: ${space(0.75)} 0;
    margin-bottom: 0;
    text-transform: uppercase;
  }
  div:first-child {
    margin-right: ${space(3)};
  }
`;
