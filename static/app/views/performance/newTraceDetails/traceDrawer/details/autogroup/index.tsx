import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {isSiblingAutogroupedNode} from '../../../traceGuards';
import type {ParentAutogroupNode} from '../../../traceModels/parentAutogroupNode';
import type {SiblingAutogroupNode} from '../../../traceModels/siblingAutogroupNode';
import {useHasTraceNewUi} from '../../../useHasTraceNewUi';
import type {TraceTreeNodeDetailsProps} from '../../tabs/traceTreeNodeDetails';
import {TraceDrawerComponents} from '../styles';

import {ParentAutogroupNodeDetails} from './parentAutogroup';
import {SiblingAutogroupNodeDetails} from './siblingAutogroup';

export function AutogroupNodeDetails(
  props: TraceTreeNodeDetailsProps<ParentAutogroupNode | SiblingAutogroupNode>
) {
  const hasTraceNewUi = useHasTraceNewUi();
  const {node, organization, onTabScrollToNode} = props;

  if (!hasTraceNewUi) {
    if (isSiblingAutogroupedNode(node)) {
      return (
        <SiblingAutogroupNodeDetails
          {...(props as TraceTreeNodeDetailsProps<SiblingAutogroupNode>)}
        />
      );
    }

    return (
      <ParentAutogroupNodeDetails
        {...(props as TraceTreeNodeDetailsProps<ParentAutogroupNode>)}
      />
    );
  }

  return (
    <TraceDrawerComponents.DetailContainer hasNewTraceUi={hasTraceNewUi}>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>
              {t('Autogroup')}
            </TraceDrawerComponents.TitleText>
            <TraceDrawerComponents.SubtitleWithCopyButton
              text={`ID: ${node.value.span_id}`}
            />
          </TraceDrawerComponents.LegacyTitleText>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.NodeActions
          node={node}
          organization={organization}
          onTabScrollToNode={onTabScrollToNode}
        />
      </TraceDrawerComponents.HeaderContainer>
      <TextBlock>
        {t(
          'This block represents autogrouped spans. We do this to reduce noise whenever it fits one of the following criteria:'
        )}
      </TextBlock>
      <BulletList>
        <li>{t('5 or more siblings with the same operation and description')}</li>
        <li>{t('2 or more descendants with the same operation')}</li>
      </BulletList>
      <TextBlock>
        {t(
          'You can either open this autogroup using the chevron on the span or turn this functionality off using the settings dropdown above.'
        )}
      </TextBlock>
    </TraceDrawerComponents.DetailContainer>
  );
}

const TextBlock = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.5;
  margin-bottom: ${space(2)};
`;

const BulletList = styled('ul')`
  list-style-type: disc;
  padding-left: 20px;
  margin-bottom: ${space(2)};

  li {
    margin-bottom: ${space(1)};
  }
`;
