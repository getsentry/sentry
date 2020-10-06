import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';
import memoize from 'lodash/memoize';

import AsyncComponent from 'app/components/asyncComponent';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import DateTime from 'app/components/dateTime';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import DropdownButton from 'app/components/dropdownButton';
import Tag from 'app/components/tag-deprecated';
import ExternalLink from 'app/components/links/externalLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import Checkbox from 'app/components/checkbox';
import Button from 'app/components/button';
import space from 'app/styles/space';
import {IconChevron, IconFlag, IconOpen} from 'app/icons';
import {t} from 'app/locale';
import {SentryApp, SentryAppWebhookRequest, SentryAppSchemaIssueLink} from 'app/types';
import {Theme} from 'app/utils/theme';

const ALL_EVENTS = t('All Events');
const MAX_PER_PAGE = 10;

const componentHasSelectUri = (issueLinkComponent: SentryAppSchemaIssueLink): boolean => {
  const hasSelectUri = (fields: any[]): boolean =>
    fields.some(field => field.type === 'select' && 'uri' in field);

  const createHasSelectUri =
    hasSelectUri(issueLinkComponent.create.required_fields) ||
    hasSelectUri(issueLinkComponent.create.optional_fields || []);

  const linkHasSelectUri =
    hasSelectUri(issueLinkComponent.link.required_fields) ||
    hasSelectUri(issueLinkComponent.link.optional_fields || []);

  return createHasSelectUri || linkHasSelectUri;
};

const getEventTypes = memoize((app: SentryApp) => {
  // TODO(nola): ideally this would be kept in sync with EXTENDED_VALID_EVENTS on the backend

  let issueLinkEvents: string[] = [];
  const issueLinkComponent = (app.schema.elements || []).find(
    element => element.type === 'issue-link'
  );
  if (issueLinkComponent) {
    issueLinkEvents = ['external_issue.created', 'external_issue.linked'];
    if (componentHasSelectUri(issueLinkComponent as SentryAppSchemaIssueLink)) {
      issueLinkEvents.push('select_options.requested');
    }
  }

  const events = [
    ALL_EVENTS,
    // Internal apps don't have installation webhooks
    ...(app.status !== 'internal'
      ? ['installation.created', 'installation.deleted']
      : []),
    ...(app.events.includes('error') ? ['error.created'] : []),
    ...(app.events.includes('issue')
      ? ['issue.created', 'issue.resolved', 'issue.ignored', 'issue.assigned']
      : []),
    ...(app.isAlertable ? ['event_alert.triggered'] : []),
    ...issueLinkEvents,
  ];

  return events;
});

const ResponseCode = ({code}: {code: number}) => {
  let priority: keyof Theme['alert'] = 'error';
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

const TimestampLink = ({date, link}: {date: moment.MomentInput; link?: string}) =>
  link ? (
    <ExternalLink href={link}>
      <DateTime date={date} />
      <StyledIconOpen size="12px" />
    </ExternalLink>
  ) : (
    <DateTime date={date} />
  );

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

  handleChangeEventType = (eventType: string) => {
    this.setState(
      {
        eventType,
        currentPage: 0,
      },
      this.remountComponent
    );
  };

  handleChangeErrorsOnly = () => {
    this.setState(
      {
        errorsOnly: !this.state.errorsOnly,
        currentPage: 0,
      },
      this.remountComponent
    );
  };

  handleNextPage = () => {
    this.setState({
      currentPage: this.state.currentPage + 1,
    });
  };

  handlePrevPage = () => {
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
        <h5>{t('Request Log')}</h5>

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
              button={({isOpen, getActorProps}) => (
                <StyledDropdownButton {...getActorProps()} isOpen={isOpen}>
                  {eventType}
                </StyledDropdownButton>
              )}
            >
              {getEventTypes(app).map(type => (
                <DropdownItem
                  key={type}
                  onSelect={this.handleChangeEventType}
                  eventKey={type}
                  isActive={eventType === type}
                >
                  {type}
                </DropdownItem>
              ))}
            </DropdownControl>

            <StyledErrorsOnlyButton onClick={this.handleChangeErrorsOnly}>
              <ErrorsOnlyCheckbox>
                <Checkbox checked={errorsOnly} onChange={() => {}} />
                {t('Errors Only')}
              </ErrorsOnlyCheckbox>
            </StyledErrorsOnlyButton>
          </RequestLogFilters>
        </div>

        <Panel>
          <PanelHeader>
            <TableLayout hasOrganization={app.status !== 'internal'}>
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
                    <TableLayout hasOrganization={app.status !== 'internal'}>
                      <TimestampLink date={request.date} link={request.errorUrl} />
                      <ResponseCode code={request.responseCode} />
                      {app.status !== 'internal' && (
                        <div>
                          {request.organization ? request.organization.name : null}
                        </div>
                      )}
                      <div>{request.eventType}</div>
                      <OverflowBox>{request.webhookUrl}</OverflowBox>
                    </TableLayout>
                  </PanelItem>
                ))
              ) : (
                <EmptyMessage icon={<IconFlag size="xl" />}>
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
            icon={<IconChevron direction="left" size="sm" />}
            onClick={this.handlePrevPage}
            disabled={!this.hasPrevPage}
            label={t('Previous page')}
          />
          <Button
            icon={<IconChevron direction="right" size="sm" />}
            onClick={this.handleNextPage}
            disabled={!this.hasNextPage}
            label={t('Next page')}
          />
        </PaginationButtons>
      </React.Fragment>
    );
  }
}

const TableLayout = styled('div')<{hasOrganization: boolean}>`
  display: grid;
  grid-template-columns: 1fr 0.5fr ${p => (p.hasOrganization ? '1fr' : '')} 1fr 1fr;
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

const RequestLogFilters = styled('div')`
  display: flex;
  align-items: center;
  padding-bottom: ${space(1)};
`;

const ErrorsOnlyCheckbox = styled('div')`
  input {
    margin: 0 ${space(1)} 0 0;
  }

  display: flex;
  align-items: center;
`;

const StyledDropdownButton = styled(DropdownButton)`
  z-index: ${p => p.theme.zIndex.header - 1};
  white-space: nowrap;

  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
`;

const StyledErrorsOnlyButton = styled(Button)`
  margin-left: -1px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
`;

const StyledIconOpen = styled(IconOpen)`
  margin-left: 6px;
  color: ${p => p.theme.gray600};
`;
