import React from 'react';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import {Event, Group, GroupTombstone, Organization} from 'app/types';
import {getTitle} from 'app/utils/events';
import withOrganization from 'app/utils/withOrganization';

import StacktracePreview from './stacktracePreview';

type Props = {
  data: Event | Group | GroupTombstone;
  organization: Organization;
  style?: React.CSSProperties;
  hasGuideAnchor?: boolean;
};

class EventOrGroupTitle extends React.Component<Props> {
  render() {
    const {hasGuideAnchor, data, organization} = this.props;
    const {title, subtitle} = getTitle(data as Event, organization);

    const titleWithHoverStacktrace = (
      <StacktracePreview organization={organization} issueId={data.id}>
        {title}
      </StacktracePreview>
    );

    return subtitle ? (
      <span style={this.props.style}>
        <GuideAnchor disabled={!hasGuideAnchor} target="issue_title" position="bottom">
          <span>{titleWithHoverStacktrace}</span>
        </GuideAnchor>
        <Spacer />
        <em title={subtitle}>{subtitle}</em>
        <br />
      </span>
    ) : (
      <span style={this.props.style}>
        <GuideAnchor disabled={!hasGuideAnchor} target="issue_title" position="bottom">
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
