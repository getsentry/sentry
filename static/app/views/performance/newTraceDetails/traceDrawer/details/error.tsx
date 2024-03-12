import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {TraceTree, TraceTreeNode} from '../../traceTree';

import {TraceDrawerComponents} from './styles';

export function ErrorNodeDetails({
  node,
  organization,
}: {
  node: TraceTreeNode<TraceTree.TraceError>;
  organization: Organization;
}) {
  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.IconTitleWrapper>
        <TraceDrawerComponents.IconBorder errored>
          <IconFire color="errorText" size="md" />
        </TraceDrawerComponents.IconBorder>
        <div style={{fontWeight: 'bold'}}>{t('Error')}</div>
      </TraceDrawerComponents.IconTitleWrapper>

      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          <Row
            title={t('Title')}
            extra={
              <TraceDrawerComponents.Button
                size="xs"
                to={generateIssueEventTarget(node.value, organization)}
              >
                {t('Go to Issue')}
              </TraceDrawerComponents.Button>
            }
          >
            {node.value.title}
          </Row>
        </tbody>
      </TraceDrawerComponents.Table>
    </TraceDrawerComponents.DetailContainer>
  );
}
