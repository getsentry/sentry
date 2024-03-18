import {useMemo} from 'react';

import {IconGroup} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import type {TraceErrorOrIssue} from 'sentry/utils/performance/quickTrace/types';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {SiblingAutogroupNode} from '../../traceTree';

import {IssueList} from './issues/issues';
import {TraceDrawerComponents} from './styles';

export function SiblingAutogroupNodeDetails({
  node,
  organization,
}: {
  node: SiblingAutogroupNode;
  organization: Organization;
}) {
  const issues: TraceErrorOrIssue[] = useMemo(() => {
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

      {node.errors.length > 0 || node.performance_issues.length > 0 ? (
        <IssueList organization={organization} issues={issues} node={node} />
      ) : null}

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
