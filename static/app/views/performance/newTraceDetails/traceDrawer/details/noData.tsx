import {useRef} from 'react';
import {useTheme} from '@emotion/react';

import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import {IconGroup} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {
  type SectionCardKeyValueList,
  TraceDrawerComponents,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  makeTraceNodeBarColor,
  type NoDataNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export function NoDataDetails(props: TraceTreeNodeDetailsProps<NoDataNode>) {
  const theme = useTheme();

  const items: SectionCardKeyValueList = [
    {
      key: 'data_quality',
      subject: t('Data quality'),
      value: tct(
        'The cause of missing data could be misconfiguration or lack of instrumentation. Send us [feedback] if you are having trouble figuring this out.',
        {feedback: <InlineFeedbackLink />}
      ),
    },
  ];

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

        <TraceDrawerComponents.NodeActions
          organization={props.organization}
          node={props.node}
          onTabScrollToNode={props.onTabScrollToNode}
        />
      </TraceDrawerComponents.HeaderContainer>

      <TraceDrawerComponents.SectionCard items={items} title={t('General')} />
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
