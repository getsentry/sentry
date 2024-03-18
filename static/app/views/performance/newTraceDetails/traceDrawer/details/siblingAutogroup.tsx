import {IconGroup} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {SiblingAutogroupNode} from '../../traceTree';

import {IssueList} from './issues/issues';
import {TraceDrawerComponents} from './styles';
import { useMemo } from 'react';

export function SiblingAutogroupNodeDetails({
  node,
  organization,
}: {
  node: SiblingAutogroupNode;
  organization: Organization;
}) {
  const issues = useMemo(() => {
    return [...node.errors, ...node.performance_issues];
  }, [node.errors, node.performance_issues]);

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.IconTitleWrapper>
        <TraceDrawerComponents.IconBorder>
          <IconGroup color="blue300" />
        </TraceDrawerComponents.IconBorder>
        <div style={{fontWeight: 'bold'}}>{t('Autogroup')}</div>
      </TraceDrawerComponents.IconTitleWrapper>

      <IssueList issues={issues} node={node} organization={organization} />

      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          <Row title={t('Grouping Logic')}>
            {t('5 or more sibling spans with the same operation and description.')}
          </Row>
          <Row title={t('Group Count')}>{node.groupCount}</Row>
          <Row title={t('Grouping Key')}>
            {tct('Span operation: [operation] and description: [description]', {
              operation: node.value.op,
              description: node.value.description,
            })}
          </Row>
        </tbody>
      </TraceDrawerComponents.Table>
    </TraceDrawerComponents.DetailContainer>
  );
}
