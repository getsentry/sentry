import {useRef} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from 'sentry/components/button';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import {IconGroup} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {
  makeTraceNodeBarColor,
  type NoDataNode,
  type TraceTree,
  type TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceTree';
import {Row} from 'sentry/views/performance/traceDetails/styles';

interface NoDataDetailsProps {
  node: NoDataNode;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
}

export function NoDataDetails(props: NoDataDetailsProps) {
  const theme = useTheme();

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.IconTitleWrapper>
          <TraceDrawerComponents.IconBorder
            backgroundColor={makeTraceNodeBarColor(theme, props.node)}
          >
            <IconGroup />
          </TraceDrawerComponents.IconBorder>
          <div style={{fontWeight: 'bold'}}>{t('Empty')}</div>
        </TraceDrawerComponents.IconTitleWrapper>

        <TraceDrawerComponents.Actions>
          <Button size="xs" onClick={_e => props.scrollToNode(props.node)}>
            {t('Show in view')}
          </Button>
        </TraceDrawerComponents.Actions>
      </TraceDrawerComponents.HeaderContainer>

      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          <Row title={t('Data quality')}>
            {tct(
              'The cause of missing data could be misconfiguration or lack of instrumentation. Send us [feedback] if you are having trouble figuring this out.',
              {feedback: <InlineFeedbackLink />}
            )}
          </Row>
        </tbody>
      </TraceDrawerComponents.Table>
    </TraceDrawerComponents.DetailContainer>
  );
}

function InlineFeedbackLink() {
  const linkref = useRef<HTMLAnchorElement>(null);
  const feedback = useFeedbackWidget({buttonRef: linkref});
  return feedback ? (
    <a href="#" ref={linkref}>
      {t('feedback')}
    </a>
  ) : (
    <a href="mailto:support@sentry.io?subject=Trace%20does%20not%20contain%20data">
      {t('feedback')}
    </a>
  );
}
