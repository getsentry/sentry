import React from 'react';
import styled from 'react-emotion';
import moment from 'moment-timezone';

import AsyncComponent from 'app/components/asyncComponent';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import DateTime from 'app/components/dateTime';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Tag from 'app/views/settings/components/tag';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import Checkbox from 'app/components/checkbox';
import Button from 'app/components/button';

import theme from 'app/utils/theme';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {SentryApp, SentryAppWebhookRequest} from 'app/types';

const ALL_EVENTS = t('All Events');
const MAX_PER_PAGE = 10;

const ResponseCode = ({code}: {code: number}) => {
  let priority = 'error';
  if (code <= 399 && code >= 300) {
    priority = 'warning';
  } else if (code <= 299 && code >= 100) {
    priority = 'success';
  }

  return (
    <div>
      <Tag priority={priority}>{code === 0 ? 'timeout' : code}</Tag>
    </div>
  );
};

const TimestampLink = ({date, link}: {date: moment.MomentInput; link?: string}) => {
  return link ? (
    <Link to={link}>
      <DateTime date={date} />
    </Link>
  ) : (
    <DateTime date={date} />
  );
};

type Props = AsyncComponent['props'] & {
  app: SentryApp;
};

type State = AsyncComponent['state'] & {
  eventType: string;
  errorsOnly: boolean;
  currentPage: number;
  requests: SentryAppWebhookRequest[];
};

export default class RequestLog extends AsyncComponent<Props, State> {
  shouldReload = true;

  get eventTypes() {
    // TODO(nola): ideally this would be kept in sync with EXTENDED_VALID_EVENTS on the backend

    const {app} = this.props;
    let events = [ALL_EVENTS, 'installation.created', 'installation.deleted'];

    if (app.events.includes('error')) {
      events = [...events, 'error.created'];
    }
    if (app.events.includes('issue')) {
      events = [
        ...events,
        'issue.created',
        'issue.resolved',
        'issue.ignored',
        'issue.assigned',
      ];
    }
    if (app.isAlertable) {
      events = [...events, 'event_alert.triggered'];
    }

    const issueLinkComponent: any = (app.schema.elements || []).find(
      (element: any) => element.type === 'issue-link'
    );
    if (issueLinkComponent) {
      const issueLinkEvents = ['external_issue.created', 'external_issue.linked'];
      if (
        (issueLinkComponent.create && issueLinkComponent.create.uri) ||
        (issueLinkComponent.link && issueLinkComponent.link.uri)
      ) {
        issueLinkEvents.push('select_options.requested');
      }
      events = [...events, ...issueLinkEvents];
    }

    return events;
  }

  get hasNextPage() {
    return (this.state.currentPage + 1) * MAX_PER_PAGE < this.state.requests.length;
  }

  get hasPrevPage() {
    return this.state.currentPage > 0;
  }

  getEndpoints(): Array<[string, string, any] | [string, string]> {
    const {slug} = this.props.app;

    const query: any = {};
    if (this.state) {
      if (this.state.eventType !== ALL_EVENTS) {
        query.eventType = this.state.eventType;
      }
      if (this.state.errorsOnly) {
        query.errorsOnly = true;
      }
    }

    return [['requests', `/sentry-apps/${slug}/requests/`, {query}]];
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      requests: [],
      eventType: ALL_EVENTS,
      errorsOnly: false,
      currentPage: 0,
    };
  }

  onChangeEventType = eventType => {
    this.setState({
      eventType,
      currentPage: 0,
    });
    this.remountComponent();
  };

  onChangeErrorsOnly = () => {
    this.setState({
      errorsOnly: !this.state.errorsOnly,
      currentPage: 0,
    });
    this.remountComponent();
  };

  onNextPage = () => {
    this.setState({
      currentPage: this.state.currentPage + 1,
    });
  };

  onPrevPage = () => {
    this.setState({
      currentPage: this.state.currentPage - 1,
    });
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {requests, eventType, errorsOnly, currentPage} = this.state;
    const {app} = this.props;

    const currentRequests = requests.slice(
      currentPage * MAX_PER_PAGE,
      (currentPage + 1) * MAX_PER_PAGE
    );

    return (
      <React.Fragment>
        <h4>{t('Request Log')}</h4>

        <div>
          <p>
            {t(
              'This log shows the status of any outgoing webhook requests from Sentry to your integration.'
            )}
          </p>

          <RequestLogFilters>
            <DropdownControl
              label={eventType}
              menuWidth="220px"
              buttonProps={{style: {zIndex: theme.zIndex.header - 1}}}
            >
              {this.eventTypes.map(type => (
                <DropdownItem
                  key={type}
                  onSelect={this.onChangeEventType}
                  eventKey={type}
                  isActive={eventType === type}
                >
                  {type}
                </DropdownItem>
              ))}
            </DropdownControl>

            <Button
              onClick={this.onChangeErrorsOnly}
              priority={errorsOnly ? 'primary' : 'default'}
            >
              <ErrorsOnlyCheckbox>
                <Checkbox onChange={() => {}} checked={errorsOnly} />
                {t('Errors Only')}
              </ErrorsOnlyCheckbox>
            </Button>
          </RequestLogFilters>
        </div>

        <Panel>
          <PanelHeader>
            <TableLayout>
              <div>{t('Time')}</div>
              <div>{t('Status Code')}</div>
              {app.status !== 'internal' && <div>{t('Organization')}</div>}
              <div>{t('Event Type')}</div>
              <div>{t('Webhook URL')}</div>
            </TableLayout>
          </PanelHeader>

          {!this.state.loading ? (
            <PanelBody>
              {currentRequests.length > 0 ? (
                currentRequests.map((request, idx) => (
                  <PanelItem key={idx}>
                    <TableLayout>
                      <TimestampLink date={request.date} />
                      <ResponseCode code={request.responseCode} />
                      {app.status !== 'internal' && request.organization && (
                        <div>{request.organization.name}</div>
                      )}
                      <div>{request.eventType}</div>
                      <OverflowBox>{request.webhookUrl}</OverflowBox>
                    </TableLayout>
                  </PanelItem>
                ))
              ) : (
                <EmptyMessage icon="icon-circle-exclamation">
                  {t('No requests found in the last 30 days.')}
                </EmptyMessage>
              )}
            </PanelBody>
          ) : (
            <LoadingIndicator />
          )}
        </Panel>

        <PaginationButtons>
          <Button
            icon="icon-chevron-left"
            onClick={this.onPrevPage}
            disabled={!this.hasPrevPage}
            label="Previous page"
          />
          <Button
            icon="icon-chevron-right"
            onClick={this.onNextPage}
            disabled={!this.hasNextPage}
            label="Next page"
          />
        </PaginationButtons>
      </React.Fragment>
    );
  }
}

const TableLayout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 0.5fr 1fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const OverflowBox = styled('div')`
  word-break: break-word;
`;

const PaginationButtons = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;

  > :first-child {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  > :nth-child(2) {
    margin-left: -1px;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

// const ButtonGroup = styled('div')`

// `

const RequestLogFilters = styled('div')`
  display: flex;
  align-items: center;
  padding-bottom: ${space(1)};

  > * + * {
    margin-left: ${space(1)};
  }
`;

const ErrorsOnlyCheckbox = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;

  > input {
    margin: 0 ${space(1)} 0 0;
  }
`;

// const EventTypeDropdown = styled(DropdownControl)`
//   z-index: ${p => p.theme.zIndex.header - 1};
// `;
