import React from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import {Group, GroupTombstone, Organization} from 'app/types';
import {Event} from 'app/types/event';
import {getTitle} from 'app/utils/events';
import withOrganization from 'app/utils/withOrganization';

import StacktracePreview from './stacktracePreview';

type Props = Partial<DefaultProps> & {
  data: Event | Group | GroupTombstone;
  organization: Organization;
  style?: React.CSSProperties;
  hasGuideAnchor?: boolean;
  withStackTracePreview?: boolean;
  guideAnchorName?: string;
};

type DefaultProps = {
  guideAnchorName: string;
};

class EventOrGroupTitle extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    guideAnchorName: 'issue_title',
  };
  render() {
    const {
      hasGuideAnchor,
      data,
      organization,
      withStackTracePreview,
      guideAnchorName,
    } = this.props;
    const {title, subtitle} = getTitle(data as Event, organization);

    const titleWithHoverStacktrace = (
      <StacktracePreview
        organization={organization}
        issueId={data.id}
        disablePreview={!withStackTracePreview}
      >
        {title}
      </StacktracePreview>
    );

    return subtitle ? (
      <span style={this.props.style}>
        <GuideAnchor
          disabled={!hasGuideAnchor}
          target={guideAnchorName}
          position="bottom"
        >
          <span>{titleWithHoverStacktrace}</span>
        </GuideAnchor>
        <Spacer />
        <Subtitle title={subtitle}>{subtitle}</Subtitle>
        <br />
      </span>
    ) : (
      <span style={this.props.style}>
        <GuideAnchor
          disabled={!hasGuideAnchor}
          target={guideAnchorName}
          position="bottom"
        >
          {titleWithHoverStacktrace}
        </GuideAnchor>
      </span>
    );
  }
}

export default withOrganization(EventOrGroupTitle);

/**
 * &nbsp; is used instead of margin/padding to split title and subtitle
 * into 2 separate text nodes on the HTML AST. This allows the
 * title to be highlighted without spilling over to the subtitle.
 */
const Spacer = () => <span style={{display: 'inline-block', width: 10}}>&nbsp;</span>;

const Subtitle = styled('em')`
  color: ${p => p.theme.gray300};
  font-style: normal;
`;
