import {useMemo} from 'react';

import {IconGroup} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import type {TraceErrorOrIssue} from 'sentry/utils/performance/quickTrace/types';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {ParentAutogroupNode} from '../../traceTree';

import {IssueList} from './issues/issues';
import {TraceDrawerComponents} from './styles';

export function ParentAutogroupNodeDetails({
  node,
  organization,
}: {
  node: ParentAutogroupNode;
  organization: Organization;
}) {
  const issues: TraceErrorOrIssue[] = useMemo(() => {
    return [...node.errors, ...node.performance_issues];
  }, [node.errors, node.performance_issues]);

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.IconTitleWrapper>
        <TraceDrawerComponents.IconBorder>
          <IconGroup color="blue300" size="md" />
        </TraceDrawerComponents.IconBorder>
        <div style={{fontWeight: 'bold'}}>{t('Autogroup')}</div>
      </TraceDrawerComponents.IconTitleWrapper>

      {node.errors.length > 0 || node.performance_issues.length > 0 ? (
        <IssueList organization={organization} issues={issues} node={node} />
      ) : null}

      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          <Row title={t('Grouping Logic')}>
            {t(
              'Chain of immediate and only children spans with the same operation as their parent.'
            )}
          </Row>
          <Row title={t('Group Count')}>{node.groupCount}</Row>
          <Row title={t('Grouping Key')}>
            {t('Span Operation')} : {node.value.op}
          </Row>
        </tbody>
      </TraceDrawerComponents.Table>
    </TraceDrawerComponents.DetailContainer>
  );
}
