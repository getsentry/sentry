import {Component, Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import ErrorBoundary from 'app/components/errorBoundary';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Tooltip from 'app/components/tooltip';
import {IconMute, IconStar} from 'app/icons';
import {tct} from 'app/locale';
import {Group, GroupTombstone, Level, Organization} from 'app/types';
import {Event} from 'app/types/event';
import {getLocation, getMessage} from 'app/utils/events';
import withOrganization from 'app/utils/withOrganization';
import {TagAndMessageWrapper} from 'app/views/organizationGroupDetails/unhandledTag';

import EventTitleError from './eventTitleError';

type DefaultProps = {
  includeLink: boolean;
  size: 'small' | 'normal';
};

type Props = WithRouterProps<{orgId: string}> & {
  organization: Organization;
  data: Event | Group | GroupTombstone;
  hideIcons?: boolean;
  hideLevel?: boolean;
  query?: string;
  className?: string;
  /** Group link clicked */
  onClick?: () => void;
  index?: number;
} & Partial<DefaultProps>;

/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
class EventOrGroupHeader extends Component<Props> {
  static defaultProps: DefaultProps = {
    includeLink: true,
    size: 'normal',
  };

  getTitleChildren() {
    const {hideIcons, hideLevel, data, index, organization} = this.props;
    const {level, status, isBookmarked, hasSeen} = data as Group;
    const hasGroupingTreeUI = !!organization.features?.includes('grouping-tree-ui');

    return (
      <Fragment>
        {!hideLevel && level && (
          <GroupLevel level={level}>
            <Tooltip title={`Error level: ${capitalize(level)}`}>
              <span />
            </Tooltip>
          </GroupLevel>
        )}
        {!hideIcons && status === 'ignored' && (
          <IconWrapper>
            <IconMute color="red300" />
          </IconWrapper>
        )}
        {!hideIcons && isBookmarked && (
          <IconWrapper>
            <IconStar isSolid color="yellow300" />
          </IconWrapper>
        )}

        <ErrorBoundary customComponent={<EventTitleError />} mini>
          <StyledEventOrGroupTitle
            {...this.props}
            hasSeen={hasGroupingTreeUI && hasSeen === undefined ? true : hasSeen}
            withStackTracePreview
            hasGuideAnchor={index === 0}
            guideAnchorName="issue_stream_title"
          />
        </ErrorBoundary>
      </Fragment>
    );
  }

  getTitle() {
    const {includeLink, data, params, location, onClick} = this.props;

    const orgId = params?.orgId;

    const {id, status} = data as Group;
    const {eventID, groupID} = data as Event;

    const props = {
      'data-test-id': status === 'resolved' ? 'resolved-issue' : null,
      style: status === 'resolved' ? {textDecoration: 'line-through'} : undefined,
    };

    if (includeLink) {
      return (
        <GlobalSelectionLink
          {...props}
          to={{
            pathname: `/organizations/${orgId}/issues/${eventID ? groupID : id}/${
              eventID ? `events/${eventID}/` : ''
            }`,
            query: {
              query: this.props.query,
              ...(location.query.sort !== undefined ? {sort: location.query.sort} : {}), // This adds sort to the query if one was selected from the issues list page
              ...(location.query.project !== undefined ? {} : {_allp: 1}), // This appends _allp to the URL parameters if they have no project selected ("all" projects included in results). This is so that when we enter the issue details page and lock them to a project, we can properly take them back to the issue list page with no project selected (and not the locked project selected)
            },
          }}
          onClick={onClick}
        >
          {this.getTitleChildren()}
        </GlobalSelectionLink>
      );
    } else {
      return <span {...props}>{this.getTitleChildren()}</span>;
    }
  }

  render() {
    const {className, size, data} = this.props;
    const location = getLocation(data);
    const message = getMessage(data);

    return (
      <div className={className} data-test-id="event-issue-header">
        <Title size={size}>{this.getTitle()}</Title>
        {location && <Location size={size}>{location}</Location>}
        {message && (
          <StyledTagAndMessageWrapper size={size}>
            {message && <Message>{message}</Message>}
          </StyledTagAndMessageWrapper>
        )}
      </div>
    );
  }
}

const truncateStyles = css`
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const getMargin = ({size}) => {
  if (size === 'small') {
    return 'margin: 0;';
  }

  return 'margin: 0 0 5px';
};

const Title = styled('div')`
  ${truncateStyles};
  line-height: 1;
  ${getMargin};
  & em {
    font-size: ${p => p.theme.fontSizeMedium};
    font-style: normal;
    font-weight: 300;
    color: ${p => p.theme.subText};
  }
`;

const LocationWrapper = styled('div')`
  ${truncateStyles};
  ${getMargin};
  direction: rtl;
  text-align: left;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  span {
    direction: ltr;
  }
`;

function Location(props) {
  const {children, ...rest} = props;
  return (
    <LocationWrapper {...rest}>
      {tct('in [location]', {
        location: <span>{children}</span>,
      })}
    </LocationWrapper>
  );
}

const StyledTagAndMessageWrapper = styled(TagAndMessageWrapper)`
  ${getMargin};
`;

const Message = styled('div')`
  ${truncateStyles};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const IconWrapper = styled('span')`
  position: relative;
  top: 2px;

  margin-right: 5px;
`;

const GroupLevel = styled('div')<{level: Level}>`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => p.theme.level[p.level] ?? p.theme.level.default};

  & span {
    display: block;
    width: 9px;
    height: 15px;
  }
`;

export default withRouter(withOrganization(EventOrGroupHeader));

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)<{
  hasSeen: boolean;
}>`
  font-weight: ${p => (p.hasSeen ? 400 : 600)};
`;
