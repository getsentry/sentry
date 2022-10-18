import {Fragment, useState} from 'react';
import {browserHistory, WithRouterProps} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useEffect} from '@storybook/addons';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import Buttonbar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import DateTime from 'sentry/components/dateTime';
import {getRelativeTimeFromEventDateCreated} from 'sentry/components/events/contexts/utils';
import NotAvailable from 'sentry/components/notAvailable';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {EventAttachment, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined, formatBytesBase2} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';
import useApi from 'sentry/utils/useApi';

import ImageVisualization from './imageVisualization';

type Props = ModalRenderProps & {
  downloadUrl: string;
  eventAttachment: EventAttachment;
  onDelete: () => void;
  onDownload: () => void;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  enablePagination?: boolean;
  event?: Event;
} & WithRouterProps<{groupId: string; orgId: string}>;

function Modal({
  eventAttachment,
  orgSlug,
  projectSlug,
  Header,
  Body,
  Footer,
  event,
  onDelete,
  downloadUrl,
  onDownload,
  params,
  enablePagination,
  location,
}: Props) {
  const {dateCreated, size, mimetype} = eventAttachment;
  const api = useApi();
  const [currentEventAttachment, setCurrentEventAttachment] =
    useState<EventAttachment>(eventAttachment);

  const handleCursor: CursorHandler = (cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, cursor},
    });
  };

  useEffect(() => {
    const shouldCancelRequest = false;

    if (!enablePagination) {
      return undefined;
    }

    api.requestPromise(`/issues/${params.groupId}/attachments/`, {
      method: 'GET',
      query: {
        ...location.query,
        types: undefined, // need to explicitly set this to undefined because AsyncComponent adds location query back into the params
        screenshot: 1,
        per_page: 1,
      },
    });
  });

  return (
    <Fragment>
      <Header closeButton>{t('Screenshot')}</Header>
      <Body>
        <GeralInfo>
          <Label coloredBg>{t('Date Created')}</Label>
          <Value coloredBg>
            {dateCreated ? (
              <Fragment>
                <DateTime
                  date={getDynamicText({
                    value: dateCreated,
                    fixed: new Date(1508208080000),
                  })}
                />
                {event &&
                  getRelativeTimeFromEventDateCreated(
                    event.dateCreated ? event.dateCreated : event.dateReceived,
                    dateCreated,
                    false
                  )}
              </Fragment>
            ) : (
              <NotAvailable />
            )}
          </Value>

          <Label>{t('Size')}</Label>
          <Value>{defined(size) ? formatBytesBase2(size) : <NotAvailable />}</Value>

          <Label coloredBg>{t('MIME Type')}</Label>
          <Value coloredBg>{mimetype ?? <NotAvailable />}</Value>
        </GeralInfo>

        <StyledImageVisualization
          attachment={eventAttachment}
          orgId={orgSlug}
          projectId={projectSlug}
          eventId={eventAttachment.event_id}
        />
      </Body>
      <Footer>
        <Buttonbar gap={1}>
          <Confirm
            confirmText={t('Delete')}
            header={t(
              'Screenshots help identify what the user saw when the event happened'
            )}
            message={t('Are you sure you wish to delete this screenshot?')}
            priority="danger"
            onConfirm={onDelete}
          >
            <Button priority="danger">{t('Delete')}</Button>
          </Confirm>
          <Button onClick={onDownload} href={downloadUrl}>
            {t('Download')}
          </Button>
        </Buttonbar>
        <Pagination onCursor={handleCursor} />
      </Footer>
    </Fragment>
  );
}

export default Modal;

const GeralInfo = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(3)};
`;

const Label = styled('div')<{coloredBg?: boolean}>`
  color: ${p => p.theme.textColor};
  padding: ${space(1)} ${space(1.5)} ${space(1)} ${space(1)};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
`;

const Value = styled(Label)`
  white-space: pre-wrap;
  word-break: break-all;
  color: ${p => p.theme.subText};
  padding: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
`;

const StyledImageVisualization = styled(ImageVisualization)`
  img {
    border-radius: ${p => p.theme.borderRadius};
  }
`;

export const modalCss = css`
  width: auto;
  height: 100%;
  max-width: 100%;
`;
