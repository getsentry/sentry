import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {ParentAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/parentAutogroupNode';
import type {SiblingAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/siblingAutogroupNode';

export function AutogroupNodeDetails(
  props: TraceTreeNodeDetailsProps<ParentAutogroupNode | SiblingAutogroupNode>
) {
  const {node, organization, onTabScrollToNode} = props;

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>
              {t('Autogroup')}
            </TraceDrawerComponents.TitleText>
            <TraceDrawerComponents.SubtitleWithCopyButton
              subTitle={`ID: ${node.value.span_id}`}
              clipboardText={node.value.span_id}
            />
          </TraceDrawerComponents.LegacyTitleText>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.NodeActions
          node={node}
          organization={organization}
          onTabScrollToNode={onTabScrollToNode}
        />
      </TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.BodyContainer>
        {t(
          'This block represents autogrouped spans. We do this to reduce noise whenever it fits one of the following criteria:'
        )}
        <BulletList>
          <li>{t('5 or more siblings with the same operation and description')}</li>
          <li>{t('2 or more descendants with the same operation')}</li>
        </BulletList>
        {t(
          'You can either open this autogroup using the chevron on the span or turn this functionality off using the settings dropdown above.'
        )}
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}

const BulletList = styled('ul')`
  margin: ${space(1)} 0;
`;
